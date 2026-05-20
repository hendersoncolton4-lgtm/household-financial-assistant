import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import * as schema from "./schema";
import { PLAID_PFC_PRIMARY } from "./schema";

const DDL = `
CREATE TABLE IF NOT EXISTS plaid_items (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  access_token_enc TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  cursor TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'plaid',
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  mask TEXT,
  current_balance REAL,
  available_balance REAL,
  credit_limit REAL,
  iso_currency_code TEXT DEFAULT 'USD',
  interest_rate REAL,
  monthly_payment REAL,
  original_principal REAL,
  lender_name TEXT,
  notes TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_item_id ON accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(source);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  iso_currency_code TEXT DEFAULT 'USD',
  name TEXT NOT NULL,
  merchant_name TEXT,
  category TEXT,
  category_key TEXT,
  pending INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_key ON transactions(category_key);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_name ON transactions(merchant_name);

CREATE TABLE IF NOT EXISTS categories (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS category_rules (
  id TEXT PRIMARY KEY,
  merchant_key TEXT NOT NULL,
  amount_min REAL,
  amount_max REAL,
  category_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_category_rules_merchant_key ON category_rules(merchant_key);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL,
  target_date TEXT,
  linked_account_id TEXT,
  starting_amount REAL,
  starting_amount_date TEXT,
  monthly_contribution REAL,
  expected_return_rate REAL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_archived ON goals(archived);

CREATE TABLE IF NOT EXISTS monthly_reviews (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  content TEXT NOT NULL,
  net_worth_snapshot REAL,
  inflow_snapshot REAL,
  outflow_snapshot REAL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monthly_reviews_period_end ON monthly_reviews(period_end);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  signature TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  suggestion TEXT,
  amount REAL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  snoozed_until INTEGER,
  scanned_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_type ON findings(type);

CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  primary_name TEXT,
  primary_dob TEXT,
  secondary_name TEXT,
  secondary_dob TEXT,
  filing_status TEXT,
  state TEXT,
  number_of_dependents INTEGER,
  primary_annual_income REAL,
  secondary_annual_income REAL,
  primary_employer_match_percent REAL,
  primary_employer_match_up_to REAL,
  secondary_employer_match_percent REAL,
  secondary_employer_match_up_to REAL,
  hsa_eligible INTEGER NOT NULL DEFAULT 0,
  hsa_coverage_type TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_contributions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  person TEXT NOT NULL,
  account_type TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tax_contributions_year ON tax_contributions(year);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  insured_name TEXT,
  carrier TEXT,
  coverage_amount REAL,
  premium_monthly REAL,
  beneficiary TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS estate_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  for_person TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  last_reviewed TEXT,
  notes TEXT,
  is_seeded INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  exchange TEXT,
  asset_class TEXT,
  tradable INTEGER NOT NULL DEFAULT 1,
  status TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);

CREATE TABLE IF NOT EXISTS securities (
  id TEXT PRIMARY KEY,
  ticker TEXT,
  name TEXT,
  type TEXT,
  isin TEXT,
  cusip TEXT,
  close_price REAL,
  close_price_as_of TEXT,
  iso_currency_code TEXT DEFAULT 'USD',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_securities_ticker ON securities(ticker);

CREATE TABLE IF NOT EXISTS holdings (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  institution_price REAL,
  institution_price_as_of TEXT,
  institution_value REAL,
  cost_basis REAL,
  iso_currency_code TEXT DEFAULT 'USD',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_holdings_item_id ON holdings(item_id);
CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON holdings(account_id);
CREATE INDEX IF NOT EXISTS idx_holdings_security_id ON holdings(security_id);

CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  name TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS theses (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  content TEXT NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'ai',
  price_snapshot REAL,
  news_headline_count INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_theses_symbol ON theses(symbol);

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity REAL NOT NULL,
  limit_price REAL,
  time_in_force TEXT NOT NULL DEFAULT 'day',
  estimated_value REAL,
  rationale TEXT NOT NULL,
  risk_notes TEXT,
  generated_by TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'pending',
  alpaca_order_id TEXT,
  alpaca_order_status TEXT,
  filled_at INTEGER,
  filled_price REAL,
  filled_quantity REAL,
  failure_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_symbol ON proposals(symbol);

CREATE TABLE IF NOT EXISTS funds (
  cik TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_filings (
  id TEXT PRIMARY KEY,
  cik TEXT NOT NULL,
  accession_number TEXT NOT NULL UNIQUE,
  form_type TEXT NOT NULL,
  filing_date TEXT NOT NULL,
  report_date TEXT NOT NULL,
  holdings_count INTEGER NOT NULL DEFAULT 0,
  total_value REAL NOT NULL DEFAULT 0,
  filing_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fund_filings_cik ON fund_filings(cik);
CREATE INDEX IF NOT EXISTS idx_fund_filings_report_date ON fund_filings(report_date);

CREATE TABLE IF NOT EXISTS fund_holdings (
  id TEXT PRIMARY KEY,
  filing_id TEXT NOT NULL,
  cik TEXT NOT NULL,
  report_date TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  cusip TEXT,
  ticker TEXT,
  shares REAL NOT NULL,
  value REAL NOT NULL,
  pct_of_portfolio REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fund_holdings_filing_id ON fund_holdings(filing_id);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_cik ON fund_holdings(cik);
CREATE INDEX IF NOT EXISTS idx_fund_holdings_ticker ON fund_holdings(ticker);

CREATE TABLE IF NOT EXISTS congress_trades (
  id TEXT PRIMARY KEY,
  legislator TEXT NOT NULL,
  legislator_slug TEXT NOT NULL,
  chamber TEXT NOT NULL,
  state TEXT,
  party TEXT,
  ticker TEXT,
  asset_name TEXT,
  asset_type TEXT,
  side TEXT NOT NULL,
  amount_range TEXT,
  amount_min REAL,
  amount_max REAL,
  owner_type TEXT,
  date_traded TEXT NOT NULL,
  date_reported TEXT,
  comment TEXT,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_congress_legislator ON congress_trades(legislator_slug);
CREATE INDEX IF NOT EXISTS idx_congress_ticker ON congress_trades(ticker);
CREATE INDEX IF NOT EXISTS idx_congress_date_traded ON congress_trades(date_traded);
CREATE INDEX IF NOT EXISTS idx_congress_chamber ON congress_trades(chamber);
`;

/**
 * Forward-only column additions for the accounts and transactions tables.
 * Each entry runs only if the column doesn't already exist.
 */
const TABLE_MIGRATIONS: Record<string, Array<{ column: string; ddl: string }>> = {
  accounts: [
    { column: "source", ddl: "source TEXT NOT NULL DEFAULT 'plaid'" },
    { column: "interest_rate", ddl: "interest_rate REAL" },
    { column: "monthly_payment", ddl: "monthly_payment REAL" },
    { column: "original_principal", ddl: "original_principal REAL" },
    { column: "lender_name", ddl: "lender_name TEXT" },
    { column: "notes", ddl: "notes TEXT" },
    { column: "credit_limit", ddl: "credit_limit REAL" },
  ],
  transactions: [{ column: "category_key", ddl: "category_key TEXT" }],
  category_rules: [
    { column: "amount_min", ddl: "amount_min REAL" },
    { column: "amount_max", ddl: "amount_max REAL" },
  ],
};

function runMigrations(sqlite: Database.Database) {
  for (const [table, migs] of Object.entries(TABLE_MIGRATIONS)) {
    const tableExists = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      )
      .get(table);
    if (!tableExists) continue;
    const cols = sqlite
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    const existing = new Set(cols.map((c) => c.name));
    for (const m of migs) {
      if (!existing.has(m.column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${m.ddl}`);
      }
    }
  }
  // category_rules used to have a UNIQUE constraint on merchant_key. We now
  // allow multiple rules per merchant (different amount ranges), so we need
  // to drop that constraint. SQLite doesn't support DROP CONSTRAINT, so:
  // detect the old shape via sqlite_master and recreate.
  const sql = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='category_rules'")
    .get() as { sql: string } | undefined;
  if (sql && /merchant_key\s+TEXT\s+NOT NULL\s+UNIQUE/i.test(sql.sql)) {
    sqlite.exec(`
      CREATE TABLE category_rules_new (
        id TEXT PRIMARY KEY,
        merchant_key TEXT NOT NULL,
        amount_min REAL,
        amount_max REAL,
        category_key TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      INSERT INTO category_rules_new (id, merchant_key, amount_min, amount_max, category_key, created_at, updated_at)
        SELECT id, merchant_key, NULL, NULL, category_key, created_at, updated_at FROM category_rules;
      DROP TABLE category_rules;
      ALTER TABLE category_rules_new RENAME TO category_rules;
      CREATE INDEX idx_category_rules_merchant_key ON category_rules(merchant_key);
    `);
  }
}

/** Seed the standard estate-planning checklist items so the user has
 *  something to react to instead of a blank page. They can edit titles,
 *  delete items, or add their own later. */
function seedEstateItems(sqlite: Database.Database) {
  const existing = sqlite
    .prepare("SELECT COUNT(*) as c FROM estate_items WHERE is_seeded = 1")
    .get() as { c: number };
  if (existing.c > 0) return; // already seeded once

  const now = Date.now();
  const stmt = sqlite.prepare(
    `INSERT INTO estate_items (id, title, category, for_person, status, is_seeded, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'not_started', 1, ?, ?, ?)`
  );

  // Each entry is [title, category, for_person, sort_order]
  const items: Array<[string, string, string | null, number]> = [
    ["Will (primary)", "will", "primary", 10],
    ["Will (spouse)", "will", "secondary", 20],
    ["Healthcare directive / living will (primary)", "directive", "primary", 30],
    ["Healthcare directive / living will (spouse)", "directive", "secondary", 40],
    ["Power of attorney — financial (primary)", "poa_financial", "primary", 50],
    ["Power of attorney — financial (spouse)", "poa_financial", "secondary", 60],
    ["Power of attorney — medical (primary)", "poa_medical", "primary", 70],
    ["Power of attorney — medical (spouse)", "poa_medical", "secondary", 80],
    ["Beneficiary designations — retirement accounts up to date", "beneficiary", "household", 90],
    ["Beneficiary designations — life insurance up to date", "beneficiary", "household", 100],
    ["Guardianship for minor children", "guardianship", "household", 110],
    ["Trust (only if estate > federal exemption or asset-protection need)", "trust", "household", 120],
  ];

  for (const [title, cat, forPerson, order] of items) {
    stmt.run(randomId(), title, cat, forPerson, order, now, now);
  }
}

/** Simple non-crypto ID generator for seed data. */
function randomId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

/** Insert (or no-op) the Plaid PFC primary categories so the UI has options. */
function seedCategories(sqlite: Database.Database) {
  const now = Date.now();
  const stmt = sqlite.prepare(
    `INSERT INTO categories (key, label, is_custom, archived, created_at, updated_at)
     VALUES (?, ?, 0, 0, ?, ?)
     ON CONFLICT(key) DO NOTHING`
  );
  for (const [key, label] of Object.entries(PLAID_PFC_PRIMARY)) {
    stmt.run(key, label, now, now);
  }
}

/**
 * For transactions that have a Plaid `category` JSON but no `category_key`
 * (because they were synced before category_key existed), parse the JSON and
 * set category_key to the primary. One-shot, idempotent.
 */
function backfillCategoryKeys(sqlite: Database.Database) {
  const rows = sqlite
    .prepare(
      "SELECT id, category FROM transactions WHERE category_key IS NULL AND category IS NOT NULL"
    )
    .all() as Array<{ id: string; category: string }>;
  if (rows.length === 0) return;
  const upd = sqlite.prepare(
    "UPDATE transactions SET category_key = ? WHERE id = ?"
  );
  for (const r of rows) {
    try {
      const parsed = JSON.parse(r.category);
      if (Array.isArray(parsed) && parsed.length > 0) {
        upd.run(String(parsed[0]), r.id);
      }
    } catch {
      /* skip */
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __sqlite: Database.Database | undefined;
}

function init() {
  const dataDir = join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(join(dataDir, "app.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  runMigrations(sqlite);
  seedCategories(sqlite);
  seedEstateItems(sqlite);
  backfillCategoryKeys(sqlite);
  return sqlite;
}

const sqlite = global.__sqlite ?? init();
if (process.env.NODE_ENV !== "production") {
  global.__sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { schema };
