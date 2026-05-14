import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import * as schema from "./schema";

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
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  mask TEXT,
  current_balance REAL,
  available_balance REAL,
  iso_currency_code TEXT DEFAULT 'USD',
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_accounts_item_id ON accounts(item_id);

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
  pending INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

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
`;

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
  return sqlite;
}

const sqlite = global.__sqlite ?? init();
if (process.env.NODE_ENV !== "production") {
  global.__sqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { schema };
