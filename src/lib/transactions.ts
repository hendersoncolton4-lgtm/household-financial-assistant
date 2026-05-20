import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCategoryMap, labelForKey, UNCATEGORIZED_KEY } from "@/lib/categories";
import type { Account, Category, Transaction } from "@/lib/db/schema";

/** Returns transactions from the last N days, newest first. */
export function getTransactionsSince(daysBack: number): Transaction[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const iso = cutoff.toISOString().slice(0, 10);
  return db
    .select()
    .from(schema.transactions)
    .where(gte(schema.transactions.date, iso))
    .orderBy(desc(schema.transactions.date))
    .all();
}

/** All accounts as a key-by-id Map (handy for joining with transactions). */
export function getAccountMap(): Map<string, Account> {
  const accts = db.select().from(schema.accounts).all();
  return new Map(accts.map((a) => [a.id, a]));
}

/** Extract the Plaid PFC *detailed* category (the more specific one) from
 * the stored JSON array. Format: ["PRIMARY", "PRIMARY_DETAILED"]. */
export function getDetailedCategory(rawCategory: string | null): string | null {
  if (!rawCategory) return null;
  try {
    const parsed = JSON.parse(rawCategory);
    if (Array.isArray(parsed) && parsed.length > 1) return String(parsed[parsed.length - 1]);
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0]);
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Returns true when a transaction is a mirror of money moving between the
 * household's own accounts, not real cash flow. Examples:
 *  - $500 Chase credit card payment from checking → "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"
 *    on checking + matching credit on the credit-card account. Both sides are
 *    internal.
 *  - $1000 transfer from checking to savings → "TRANSFER_OUT_ACCOUNT_TRANSFER"
 *    on checking + "TRANSFER_IN_ACCOUNT_TRANSFER" on savings.
 *  - $100 401k contribution → TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS.
 *    (This one we DO want to count as outflow because it leaves the spending
 *    pool — handled separately below.)
 */
function isInternalTransfer(detailedCategory: string | null): boolean {
  if (!detailedCategory) return false;
  // Generic transfers between user's own accounts
  if (detailedCategory === "TRANSFER_IN_ACCOUNT_TRANSFER") return true;
  if (detailedCategory === "TRANSFER_OUT_ACCOUNT_TRANSFER") return true;
  // Credit card payments — the spend already counted at point of sale on the card
  if (detailedCategory === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return true;
  return false;
}

/**
 * Decide whether a transaction counts as an inflow into the household's
 * spendable cash. Credit balance changes on debt accounts (loan paydown
 * mirrors, credit card payment mirrors) are NOT inflows — they're the other
 * side of an outflow from a cash account.
 */
export function isInflow(t: Transaction, account: Account | undefined): boolean {
  if (t.pending || t.amount >= 0) return false;
  if (!account) return false;
  // Only credits on cash-style accounts represent real inflow.
  if (account.type !== "depository" && account.type !== "investment") return false;
  // Skip internal transfers
  if (isInternalTransfer(getDetailedCategory(t.category))) return false;
  return true;
}

/**
 * Decide whether a transaction counts as an outflow from the household's
 * cash. Counts:
 *  - Debits on depository/investment (real money leaving)
 *  - Debits on credit accounts (charges — real spending, even though not
 *    settled in cash yet)
 * Skips:
 *  - Internal transfers (TRANSFER_OUT_ACCOUNT_TRANSFER, credit card payments)
 */
export function isOutflow(t: Transaction, account: Account | undefined): boolean {
  if (t.pending || t.amount <= 0) return false;
  if (!account) return false;
  if (
    account.type !== "depository" &&
    account.type !== "investment" &&
    account.type !== "credit"
  ) {
    return false;
  }
  if (isInternalTransfer(getDetailedCategory(t.category))) return false;
  return true;
}

export type CashFlowSummary = {
  windowDays: number;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
};

export function cashFlow(
  txns: Transaction[],
  windowDays: number,
  accounts?: Map<string, Account>
): CashFlowSummary {
  const accts = accounts ?? getAccountMap();
  let inflow = 0;
  let outflow = 0;
  let count = 0;
  for (const t of txns) {
    const a = accts.get(t.accountId);
    if (isInflow(t, a)) {
      inflow += -t.amount;
      count++;
    } else if (isOutflow(t, a)) {
      outflow += t.amount;
      count++;
    }
  }
  return { windowDays, inflow, outflow, net: inflow - outflow, count };
}

export type CategoryRollup = {
  key: string;
  label: string;
  total: number;
  count: number;
};

export function spendingByCategory(
  txns: Transaction[],
  catMap?: Map<string, Category>,
  accounts?: Map<string, Account>
): CategoryRollup[] {
  const cm = catMap ?? getCategoryMap();
  const accts = accounts ?? getAccountMap();
  const rollup = new Map<string, { label: string; total: number; count: number }>();
  for (const t of txns) {
    if (!isOutflow(t, accts.get(t.accountId))) continue;
    const key = t.categoryKey ?? UNCATEGORIZED_KEY;
    const label = labelForKey(key, cm);
    const cur = rollup.get(key) ?? { label, total: 0, count: 0 };
    cur.total += t.amount;
    cur.count++;
    rollup.set(key, cur);
  }
  return Array.from(rollup.entries())
    .map(([key, v]) => ({ key, label: v.label, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export type MerchantRollup = {
  merchant: string;
  total: number;
  count: number;
};

export function spendingByMerchant(
  txns: Transaction[],
  limit = 15,
  accounts?: Map<string, Account>
): MerchantRollup[] {
  const accts = accounts ?? getAccountMap();
  const map = new Map<string, { total: number; count: number }>();
  for (const t of txns) {
    if (!isOutflow(t, accts.get(t.accountId))) continue;
    const key = t.merchantName ?? t.name;
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count++;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export type IncomeSource = {
  source: string;
  total: number;
  count: number;
  categoryLabel: string | null;
  isWages: boolean;
};

export function detectIncomeSources(
  txns: Transaction[],
  minSourceTotal = 100,
  catMap?: Map<string, Category>,
  accounts?: Map<string, Account>
): IncomeSource[] {
  const cm = catMap ?? getCategoryMap();
  const accts = accounts ?? getAccountMap();
  const out = new Map<
    string,
    { total: number; count: number; categoryLabel: string | null; isWages: boolean }
  >();
  for (const t of txns) {
    if (!isInflow(t, accts.get(t.accountId))) continue;
    const key = t.merchantName ?? t.name;
    const catKey = t.categoryKey;
    const isWages = catKey === "INCOME" || (catKey?.startsWith("INCOME") ?? false);
    const cur = out.get(key) ?? {
      total: 0,
      count: 0,
      categoryLabel: catKey ? labelForKey(catKey, cm) : null,
      isWages,
    };
    cur.total += -t.amount;
    cur.count++;
    cur.isWages = cur.isWages || isWages;
    out.set(key, cur);
  }
  return Array.from(out.entries())
    .map(([source, v]) => ({ source, ...v }))
    .filter((s) => s.total >= minSourceTotal)
    .sort((a, b) => b.total - a.total);
}

export function largestTransactions(
  txns: Transaction[],
  limit = 10,
  accounts?: Map<string, Account>
): Transaction[] {
  const accts = accounts ?? getAccountMap();
  return [...txns]
    .filter((t) => {
      const a = accts.get(t.accountId);
      return isInflow(t, a) || isOutflow(t, a);
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, limit);
}
