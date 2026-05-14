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
  name: text("name").notNull(),
  officialName: text("official_name"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  mask: text("mask"),
  currentBalance: real("current_balance"),
  availableBalance: real("available_balance"),
  isoCurrencyCode: text("iso_currency_code").default("USD"),
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
  category: text("category"),
  pending: integer("pending", { mode: "boolean" }).notNull().default(false),
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
export type Goal = typeof goals.$inferSelect;
export type MonthlyReview = typeof monthlyReviews.$inferSelect;

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
