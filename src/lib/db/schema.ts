import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const plaidItems = sqliteTable("plaid_items", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().unique(),
  accessTokenEnc: text("access_token_enc").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"),
  createdAt: integer("created_at").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  source: text("source").notNull().default("plaid"),
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  mask: text("mask"),
  currentBalance: real("current_balance"),
  availableBalance: real("available_balance"),
  creditLimit: real("credit_limit"), // Plaid balances.limit for credit accts
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  interestRate: real("interest_rate"),
  monthlyPayment: real("monthly_payment"),
  originalPrincipal: real("original_principal"),
  lenderName: text("lender_name"),
  notes: text("notes"),
  updatedAt: integer("updated_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  itemId: text("item_id").notNull(),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  name: text("name").notNull(),
  merchantName: text("merchant_name"),
  // Raw Plaid PFC array, kept for reference. Resolved key lives in categoryKey.
  category: text("category"),
  categoryKey: text("category_key"),
  pending: integer("pending", { mode: "boolean" }).notNull().default(false),
});

export const categories = sqliteTable("categories", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  isCustom: integer("is_custom", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Per-merchant auto-categorization rules with optional amount ranges. A
 * merchant can have multiple rules — e.g. Phillips 66 ≥ $20 = Gas,
 * Phillips 66 < $20 = Snacks. When the sync code matches a transaction
 * against rules, the most specific matching rule wins (both bounds > one
 * bound > no bounds; recency breaks ties within a tier).
 */
export const categoryRules = sqliteTable("category_rules", {
  id: text("id").primaryKey(),
  merchantKey: text("merchant_key").notNull(), // merchantName ?? name
  amountMin: real("amount_min"), // inclusive lower bound, null = no lower bound
  amountMax: real("amount_max"), // inclusive upper bound, null = no upper bound
  categoryKey: text("category_key").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  targetAmount: real("target_amount"),
  targetDate: text("target_date"),
  linkedAccountId: text("linked_account_id"),
  startingAmount: real("starting_amount"),
  startingAmountDate: text("starting_amount_date"),
  monthlyContribution: real("monthly_contribution"),
  expectedReturnRate: real("expected_return_rate"),
  notes: text("notes"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const findings = sqliteTable("findings", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'idle_cash' | 'bank_fees' | etc.
  // Deterministic identifier so re-scans dedupe to existing rows and
  // preserve the user's dismissed/snoozed state.
  signature: text("signature").notNull().unique(),
  severity: text("severity").notNull(), // 'low' | 'medium' | 'high'
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  suggestion: text("suggestion"),
  // The dollar value of the opportunity, if quantifiable (annual savings,
  // total fees in window, etc.). Display-only.
  amount: real("amount"),
  // Free-form link back to the thing this finding is about (account id,
  // goal id, merchant, category key, etc.). Display-only.
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  // 'new' | 'dismissed' | 'acted' | 'snoozed'
  status: text("status").notNull().default("new"),
  snoozedUntil: integer("snoozed_until"),
  scannedAt: integer("scanned_at").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Singleton household profile. We enforce one row with id = 'household'.
 */
export const profile = sqliteTable("profile", {
  id: text("id").primaryKey(), // always 'household'
  primaryName: text("primary_name"),
  primaryDob: text("primary_dob"), // ISO date
  secondaryName: text("secondary_name"),
  secondaryDob: text("secondary_dob"),
  filingStatus: text("filing_status"), // 'mfj' | 'mfs' | 'single' | 'hoh' | 'qw'
  state: text("state"),
  numberOfDependents: integer("number_of_dependents"),
  primaryAnnualIncome: real("primary_annual_income"),
  secondaryAnnualIncome: real("secondary_annual_income"),
  primaryEmployerMatchPercent: real("primary_employer_match_percent"),
  primaryEmployerMatchUpTo: real("primary_employer_match_up_to"),
  secondaryEmployerMatchPercent: real("secondary_employer_match_percent"),
  secondaryEmployerMatchUpTo: real("secondary_employer_match_up_to"),
  hsaEligible: integer("hsa_eligible", { mode: "boolean" }).notNull().default(false),
  hsaCoverageType: text("hsa_coverage_type"), // 'self_only' | 'family'
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const taxContributions = sqliteTable("tax_contributions", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  person: text("person").notNull(), // 'primary' | 'secondary' | 'household'
  accountType: text("account_type").notNull(), // '401k' | 'roth_401k' | 'ira_traditional' | 'ira_roth' | 'hsa' | '529' | 'sep_ira' | 'simple_ira' | 'other'
  amount: real("amount").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const insurancePolicies = sqliteTable("insurance_policies", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // see INSURANCE_TYPE_LABELS
  insuredName: text("insured_name"), // 'primary' | 'secondary' | 'household' | freeform
  carrier: text("carrier"),
  coverageAmount: real("coverage_amount"),
  premiumMonthly: real("premium_monthly"),
  beneficiary: text("beneficiary"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const estateItems = sqliteTable("estate_items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // 'will' | 'beneficiary' | 'directive' | 'poa_financial' | 'poa_medical' | 'trust' | 'guardianship' | 'other'
  forPerson: text("for_person"), // 'primary' | 'secondary' | 'household' | null
  status: text("status").notNull().default("not_started"), // 'not_started' | 'in_progress' | 'complete' | 'not_applicable'
  lastReviewed: text("last_reviewed"), // ISO date
  notes: text("notes"),
  isSeeded: integer("is_seeded", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Local cache of tradable assets, populated from Alpaca's /v2/assets endpoint.
 * Powers the typeahead on the Research add-form. Refreshed on demand.
 */
export const assets = sqliteTable("assets", {
  symbol: text("symbol").primaryKey(),
  name: text("name").notNull(),
  exchange: text("exchange"),
  assetClass: text("asset_class"),
  tradable: integer("tradable", { mode: "boolean" }).notNull().default(true),
  status: text("status"),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Investment securities (stocks, ETFs, mutual funds) as Plaid reports them.
 * The Plaid security_id is opaque per institution but stable for a given
 * security. Tickers may be null for things like brokerage-cash sweep funds.
 */
export const securities = sqliteTable("securities", {
  id: text("id").primaryKey(),
  ticker: text("ticker"),
  name: text("name"),
  type: text("type"),
  isin: text("isin"),
  cusip: text("cusip"),
  closePrice: real("close_price"),
  closePriceAsOf: text("close_price_as_of"),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  updatedAt: integer("updated_at").notNull(),
});

export const holdings = sqliteTable("holdings", {
  // Composite key: ${itemId}:${accountId}:${securityId}
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull(),
  accountId: text("account_id").notNull(),
  securityId: text("security_id").notNull(),
  quantity: real("quantity").notNull(),
  institutionPrice: real("institution_price"),
  institutionPriceAsOf: text("institution_price_as_of"),
  institutionValue: real("institution_value"),
  costBasis: real("cost_basis"),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
  updatedAt: integer("updated_at").notNull(),
});

export const watchlist = sqliteTable("watchlist", {
  symbol: text("symbol").primaryKey(), // uppercase, e.g. "AAPL"
  name: text("name"), // company name from Alpaca asset lookup
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const theses = sqliteTable("theses", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  content: text("content").notNull(),
  authorType: text("author_type").notNull().default("ai"), // 'ai' | 'user'
  // Snapshot of inputs that produced an AI thesis so the user knows what
  // information it was working from.
  priceSnapshot: real("price_snapshot"),
  newsHeadlineCount: integer("news_headline_count"),
  createdAt: integer("created_at").notNull(),
});

/**
 * Trade proposals — either AI-generated or user-typed. Goes through an
 * approval queue before submission to Alpaca. State machine:
 *   pending → approved → executed (fully filled)
 *           → rejected
 *           → approved → cancelled (user cancels before fill)
 *           → approved → failed   (Alpaca rejects: insufficient funds, etc.)
 */
export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // 'buy' | 'sell'
  orderType: text("order_type").notNull(), // 'market' | 'limit'
  quantity: real("quantity").notNull(),
  limitPrice: real("limit_price"),
  timeInForce: text("time_in_force").notNull().default("day"), // 'day' | 'gtc'
  estimatedValue: real("estimated_value"), // qty * price at proposal time
  rationale: text("rationale").notNull(),
  riskNotes: text("risk_notes"),
  generatedBy: text("generated_by").notNull().default("ai"), // 'ai' | 'user'
  status: text("status").notNull().default("pending"),
  alpacaOrderId: text("alpaca_order_id"),
  alpacaOrderStatus: text("alpaca_order_status"),
  filledAt: integer("filled_at"),
  filledPrice: real("filled_price"),
  filledQuantity: real("filled_quantity"),
  failureReason: text("failure_reason"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Watched funds (hedge funds, asset managers, etc.) whose SEC 13F filings
 * we track. CIK = 10-digit SEC identifier, zero-padded as a string.
 */
export const funds = sqliteTable("funds", {
  cik: text("cik").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** 13F filings we've pulled for each fund. */
export const fundFilings = sqliteTable("fund_filings", {
  id: text("id").primaryKey(),
  cik: text("cik").notNull(),
  accessionNumber: text("accession_number").notNull().unique(),
  formType: text("form_type").notNull(), // '13F-HR' | '13F-HR/A'
  filingDate: text("filing_date").notNull(), // ISO date
  reportDate: text("report_date").notNull(), // ISO date — end of period
  holdingsCount: integer("holdings_count").notNull().default(0),
  totalValue: real("total_value").notNull().default(0),
  filingUrl: text("filing_url"),
  createdAt: integer("created_at").notNull(),
});

/** Individual positions from a 13F filing. */
export const fundHoldings = sqliteTable("fund_holdings", {
  id: text("id").primaryKey(), // composite: filingId:cusip
  filingId: text("filing_id").notNull(),
  cik: text("cik").notNull(),
  reportDate: text("report_date").notNull(),
  issuerName: text("issuer_name").notNull(),
  cusip: text("cusip"),
  ticker: text("ticker"), // best-effort name->ticker resolution at sync time
  shares: real("shares").notNull(),
  value: real("value").notNull(), // dollars
  pctOfPortfolio: real("pct_of_portfolio").notNull(),
});

/**
 * Congressional Periodic Transaction Reports (STOCK Act). Pulled from the
 * open senatestockwatcher.com + housestockwatcher.com JSON datasets, which
 * scrape the official House Clerk and Senate disclosure portals.
 *
 * Amounts are reported as ranges by law; we keep both the raw range string
 * and parsed min/max.
 */
export const congressTrades = sqliteTable("congress_trades", {
  // SHA-256 fingerprint of legislator + date + ticker + amount + side so
  // re-sync is idempotent (insertions with same id are no-ops).
  id: text("id").primaryKey(),
  legislator: text("legislator").notNull(),
  legislatorSlug: text("legislator_slug").notNull(),
  chamber: text("chamber").notNull(),
  state: text("state"),
  party: text("party"),
  ticker: text("ticker"),
  assetName: text("asset_name"),
  assetType: text("asset_type"),
  side: text("side").notNull(),
  amountRange: text("amount_range"),
  amountMin: real("amount_min"),
  amountMax: real("amount_max"),
  ownerType: text("owner_type"),
  dateTraded: text("date_traded").notNull(),
  dateReported: text("date_reported"),
  comment: text("comment"),
  source: text("source").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const monthlyReviews = sqliteTable("monthly_reviews", {
  id: text("id").primaryKey(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  content: text("content").notNull(),
  netWorthSnapshot: real("net_worth_snapshot"),
  inflowSnapshot: real("inflow_snapshot"),
  outflowSnapshot: real("outflow_snapshot"),
  createdAt: integer("created_at").notNull(),
});

export type PlaidItem = typeof plaidItems.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MonthlyReview = typeof monthlyReviews.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type TaxContribution = typeof taxContributions.$inferSelect;
export type InsurancePolicy = typeof insurancePolicies.$inferSelect;
export type EstateItem = typeof estateItems.$inferSelect;
export type WatchlistEntry = typeof watchlist.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Security = typeof securities.$inferSelect;
export type Holding = typeof holdings.$inferSelect;
export type Thesis = typeof theses.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type Fund = typeof funds.$inferSelect;
export type FundFiling = typeof fundFilings.$inferSelect;
export type FundHolding = typeof fundHoldings.$inferSelect;
export type CongressTrade = typeof congressTrades.$inferSelect;

export type ProposalStatus =
  | "pending"
  | "approved"
  | "executed"
  | "rejected"
  | "cancelled"
  | "failed";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: "Pending approval",
  approved: "Approved — awaiting fill",
  executed: "Executed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  failed: "Failed",
};

export const FILING_STATUS_LABELS: Record<string, string> = {
  mfj: "Married filing jointly",
  mfs: "Married filing separately",
  single: "Single",
  hoh: "Head of household",
  qw: "Qualifying surviving spouse",
};

export type TaxAccountType =
  | "401k"
  | "roth_401k"
  | "ira_traditional"
  | "ira_roth"
  | "hsa"
  | "529"
  | "sep_ira"
  | "simple_ira"
  | "fsa_healthcare"
  | "fsa_dependent_care"
  | "other";

export const TAX_ACCOUNT_LABELS: Record<TaxAccountType, string> = {
  "401k": "401(k) / 403(b) — Traditional",
  roth_401k: "401(k) / 403(b) — Roth",
  ira_traditional: "Traditional IRA",
  ira_roth: "Roth IRA",
  hsa: "HSA",
  "529": "529 (college)",
  sep_ira: "SEP IRA (self-employed)",
  simple_ira: "SIMPLE IRA",
  fsa_healthcare: "Healthcare FSA",
  fsa_dependent_care: "Dependent Care FSA",
  other: "Other tax-advantaged",
};

export type InsuranceType =
  | "life_term"
  | "life_whole"
  | "disability_short"
  | "disability_long"
  | "umbrella"
  | "health"
  | "auto"
  | "home"
  | "renters"
  | "other";

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  life_term: "Life — term",
  life_whole: "Life — whole/permanent",
  disability_short: "Short-term disability",
  disability_long: "Long-term disability",
  umbrella: "Umbrella liability",
  health: "Health",
  auto: "Auto",
  home: "Homeowners",
  renters: "Renters",
  other: "Other",
};

export type EstateCategory =
  | "will"
  | "beneficiary"
  | "directive"
  | "poa_financial"
  | "poa_medical"
  | "trust"
  | "guardianship"
  | "other";

export const ESTATE_CATEGORY_LABELS: Record<EstateCategory, string> = {
  will: "Will",
  beneficiary: "Beneficiary designations",
  directive: "Healthcare directive",
  poa_financial: "Power of attorney — financial",
  poa_medical: "Power of attorney — medical",
  trust: "Trust",
  guardianship: "Guardianship",
  other: "Other",
};

export type EstateStatus = "not_started" | "in_progress" | "complete" | "not_applicable";

export const ESTATE_STATUS_LABELS: Record<EstateStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  not_applicable: "N/A",
};

/**
 * 2026 IRS contribution limits. Pulled from public guidance. Treat as defaults
 * — users can dispute via notes if they have a more current source. Catch-up
 * contributions apply at age 50 (401k/IRA) or 55 (HSA).
 */
export const TAX_LIMITS_2026 = {
  "401k_base": 24500,
  "401k_catchup_50": 8000,
  ira_base: 7500,
  ira_catchup_50: 1000,
  hsa_self_only: 4500,
  hsa_family: 9000,
  hsa_catchup_55: 1000,
  fsa_healthcare: 3300,
  fsa_dependent_care: 5000,
} as const;

export type FindingType =
  | "idle_cash"
  | "bank_fees"
  | "subscription"
  | "credit_utilization"
  | "spending_anomaly"
  | "goal_slippage";

export type FindingSeverity = "low" | "medium" | "high";
export type FindingStatus = "new" | "dismissed" | "acted" | "snoozed";

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  idle_cash: "Idle cash",
  bank_fees: "Bank & ATM fees",
  subscription: "Recurring subscription",
  credit_utilization: "Credit utilization",
  spending_anomaly: "Spending anomaly",
  goal_slippage: "Goal slippage",
};

export type GoalType =
  | "emergency_fund"
  | "debt_payoff"
  | "savings"
  | "retirement"
  | "savings_rate"
  | "custom";

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "Emergency fund",
  debt_payoff: "Debt payoff",
  savings: "Savings target",
  retirement: "Retirement",
  savings_rate: "Savings rate",
  custom: "Custom",
};

export const MANUAL_ITEM_ID = "manual";

export type ManualCategory =
  | "mortgage"
  | "auto_loan"
  | "student_loan"
  | "personal_loan"
  | "credit_card"
  | "other_debt"
  | "cash"
  | "investment"
  | "other_asset";

export const MANUAL_CATEGORY_LABELS: Record<ManualCategory, string> = {
  mortgage: "Mortgage",
  auto_loan: "Auto loan",
  student_loan: "Student loan",
  personal_loan: "Personal loan",
  credit_card: "Credit card (not on Plaid)",
  other_debt: "Other debt",
  cash: "Cash / savings (not on Plaid)",
  investment: "Investment / brokerage (not on Plaid)",
  other_asset: "Other asset",
};

export function manualCategoryToTypeSubtype(c: ManualCategory): {
  type: string;
  subtype: string;
} {
  switch (c) {
    case "mortgage":
      return { type: "loan", subtype: "mortgage" };
    case "auto_loan":
      return { type: "loan", subtype: "auto" };
    case "student_loan":
      return { type: "loan", subtype: "student" };
    case "personal_loan":
      return { type: "loan", subtype: "personal" };
    case "credit_card":
      return { type: "credit", subtype: "credit card" };
    case "other_debt":
      return { type: "loan", subtype: "other" };
    case "cash":
      return { type: "depository", subtype: "savings" };
    case "investment":
      return { type: "investment", subtype: "brokerage" };
    case "other_asset":
      return { type: "depository", subtype: "other" };
  }
}

/**
 * Seed list of Plaid PFC primary categories. The user can rename these via
 * the categories page; the keys stay stable so downstream lookups work.
 */
export const PLAID_PFC_PRIMARY: Record<string, string> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  LOAN_PAYMENTS: "Loan payments",
  BANK_FEES: "Bank fees",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Food & drink",
  GENERAL_MERCHANDISE: "General merchandise",
  HOME_IMPROVEMENT: "Home improvement",
  MEDICAL: "Medical",
  PERSONAL_CARE: "Personal care",
  GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Government & non-profit",
  TRANSPORTATION: "Transportation",
  TRAVEL: "Travel",
  RENT_AND_UTILITIES: "Rent & utilities",
  UNCATEGORIZED: "Uncategorized",
};
