import type {
  Account,
  Goal,
  Transaction,
  FindingType,
  FindingSeverity,
} from "@/lib/db/schema";
import { computeGoalProgress } from "@/lib/goals";
import { isOutflow, getDetailedCategory } from "@/lib/transactions";
import { labelForKey } from "@/lib/categories";
import type { Category } from "@/lib/db/schema";

/**
 * The shape detector functions return. The orchestrator handles persistence,
 * dedup, etc., so detectors stay pure.
 */
export type DetectedFinding = {
  type: FindingType;
  /** Stable identifier so re-scans match existing rows in the DB. Compose it
   *  from the type + the natural key of what the finding is about. */
  signature: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  suggestion?: string;
  amount?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** Approximate HYSA yield used to size the opportunity. Conservative — actual
 *  rates fluctuate, so we just want a directional number. */
const HYSA_RATE_APPROX = 0.04; // 4% APY

// ---------------------------------------------------------------------------
// Idle cash sitting in low-yield depository accounts.
//
// We can't tell from Plaid whether an account is already a HYSA, so we flag
// any non-investment depository balance over a reasonable threshold. The
// user can dismiss if it's already in a high-yield account.
// ---------------------------------------------------------------------------
export function detectIdleCash(accounts: Account[]): DetectedFinding[] {
  const out: DetectedFinding[] = [];
  for (const a of accounts) {
    if (a.source !== "plaid") continue;
    if (a.type !== "depository") continue;
    const bal = a.currentBalance ?? 0;
    if (bal < 5000) continue;
    const annualOpportunity = bal * HYSA_RATE_APPROX;
    const severity: FindingSeverity =
      bal >= 25000 ? "high" : bal >= 10000 ? "medium" : "low";
    out.push({
      type: "idle_cash",
      signature: `idle_cash:${a.id}`,
      severity,
      title: `${fmt(bal)} sitting in ${a.name}`,
      detail:
        `This is a ${a.subtype ?? a.type} balance. If it's earning a typical checking ` +
        `rate (~0%), it could be making roughly ${fmt(annualOpportunity)} per year in a high-yield ` +
        `savings account at ~${(HYSA_RATE_APPROX * 100).toFixed(0)}% APY.`,
      suggestion:
        `Keep enough here to cover a month of expenses + any bills hitting soon, then move the ` +
        `rest to an HYSA (Marcus, Ally, Capital One 360, Wealthfront Cash, Fidelity SPAXX, etc.). ` +
        `If this is already a high-yield account, just dismiss this finding.`,
      amount: annualOpportunity,
      relatedEntityType: "account",
      relatedEntityId: a.id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bank & ATM fees in the last 90 days. Anything in BANK_FEES_* is flagged.
// ---------------------------------------------------------------------------
export function detectBankFees(
  txns: Transaction[],
  accountMap: Map<string, Account>
): DetectedFinding[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  let total = 0;
  let count = 0;
  const merchants = new Map<string, number>();
  for (const t of txns) {
    if (t.date < cutoffIso) continue;
    if (t.pending) continue;
    if (!isOutflow(t, accountMap.get(t.accountId))) continue;
    const detailed = getDetailedCategory(t.category);
    const primary = t.categoryKey;
    if (primary !== "BANK_FEES" && !(detailed?.startsWith("BANK_FEES_") ?? false)) continue;
    total += t.amount;
    count++;
    const m = t.merchantName ?? t.name;
    merchants.set(m, (merchants.get(m) ?? 0) + t.amount);
  }
  if (total < 10 || count === 0) return [];
  const topMerchants = Array.from(merchants.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, v]) => `${m} (${fmt2(v)})`);
  const severity: FindingSeverity =
    total >= 150 ? "high" : total >= 50 ? "medium" : "low";
  return [
    {
      type: "bank_fees",
      signature: "bank_fees:90d",
      severity,
      title: `${fmt2(total)} in bank & ATM fees over the last 90 days`,
      detail:
        `Across ${count} transaction${count === 1 ? "" : "s"}. Biggest contributors: ${topMerchants.join(", ")}. ` +
        `That extrapolates to roughly ${fmt(total * (365 / 90))} per year.`,
      suggestion:
        `Most of these are avoidable: keep minimum balances to dodge monthly maintenance fees, ` +
        `use in-network ATMs (or banks that reimburse — Schwab, Fidelity, Charles Schwab Investor Checking), ` +
        `and link savings to checking for free overdraft transfers.`,
      amount: total * (365 / 90),
    },
  ];
}

// ---------------------------------------------------------------------------
// Recurring subscriptions: same merchant, similar amount, ~monthly cadence,
// 3+ occurrences. Heuristic but catches most real subscriptions.
// ---------------------------------------------------------------------------
export function detectSubscriptions(
  txns: Transaction[],
  accountMap: Map<string, Account>
): DetectedFinding[] {
  // Group outflows by merchant from the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
  const cutoffIso = sixMonthsAgo.toISOString().slice(0, 10);
  const byMerchant = new Map<string, Transaction[]>();
  for (const t of txns) {
    if (t.date < cutoffIso) continue;
    if (t.pending) continue;
    if (!isOutflow(t, accountMap.get(t.accountId))) continue;
    // Loan payments (mortgage, auto, student, etc.) are recurring but they
    // aren't "subscriptions" you can cancel — flagging them is noise. Same
    // for paycheck deductions and self-transfers, which would already be
    // filtered out by isOutflow above.
    if (t.categoryKey === "LOAN_PAYMENTS") continue;
    if (t.categoryKey === "RENT_AND_UTILITIES") continue; // rent / power / water — necessary
    const key = t.merchantName ?? t.name;
    const list = byMerchant.get(key) ?? [];
    list.push(t);
    byMerchant.set(key, list);
  }
  const out: DetectedFinding[] = [];
  for (const [merchant, mTxns] of byMerchant.entries()) {
    if (mTxns.length < 3) continue;
    const sorted = [...mTxns].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((t) => t.amount);
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const median = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
    if (median < 3) continue; // skip tiny
    // Are amounts clustered (within 15% of median)?
    const similar = amounts.filter((a) => Math.abs(a - median) / median <= 0.15);
    if (similar.length < 3) continue;
    // Are the dates ~monthly apart?
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const da = new Date(sorted[i - 1].date);
      const db = new Date(sorted[i].date);
      gaps.push((db.getTime() - da.getTime()) / (24 * 3600 * 1000));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 25 || avgGap > 40) continue; // monthly cadence (~30 days)
    const monthlyCost = median;
    const annualCost = monthlyCost * 12;
    const severity: FindingSeverity =
      monthlyCost >= 50 ? "high" : monthlyCost >= 15 ? "medium" : "low";
    out.push({
      type: "subscription",
      signature: `subscription:${merchant}:${Math.round(median * 100)}`,
      severity,
      title: `${merchant}: ${fmt2(monthlyCost)}/mo recurring`,
      detail:
        `Charged ${sorted.length} times over the last ~${Math.round((sorted.length - 1) * avgGap)} days, ` +
        `averaging ${fmt2(monthlyCost)} per charge. Annualized: ${fmt(annualCost)}.`,
      suggestion:
        `If you and your wife both use this and it's worth it, keep it. Otherwise — cancel, ` +
        `pause, or downgrade. Tip: check the company website rather than the app to find the cancel link.`,
      amount: annualCost,
      relatedEntityType: "merchant",
      relatedEntityId: merchant,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Credit utilization on credit-card accounts. Requires Plaid to provide a
// credit limit (account.balances.limit). If missing, we skip silently.
// ---------------------------------------------------------------------------
export function detectCreditUtilization(accounts: Account[]): DetectedFinding[] {
  const out: DetectedFinding[] = [];
  for (const a of accounts) {
    if (a.source !== "plaid") continue;
    if (a.type !== "credit") continue;
    if (a.creditLimit == null || a.creditLimit <= 0) continue;
    const balance = a.currentBalance ?? 0;
    const util = balance / a.creditLimit;
    if (util < 0.3) continue;
    const severity: FindingSeverity =
      util >= 0.7 ? "high" : util >= 0.5 ? "medium" : "low";
    out.push({
      type: "credit_utilization",
      signature: `credit_util:${a.id}`,
      severity,
      title: `${a.name} is at ${(util * 100).toFixed(0)}% utilization`,
      detail:
        `Balance ${fmt2(balance)} of ${fmt2(a.creditLimit)} limit. Most credit scoring models ` +
        `start penalizing above 30% utilization, with the biggest hits above 50–70%.`,
      suggestion:
        `If you pay this off monthly anyway, you can game the credit score by making a mid-cycle ` +
        `payment so the statement closes at a lower balance — that's the number that gets reported ` +
        `to the bureaus. Or call your issuer and ask for a credit-limit increase.`,
      amount: balance,
      relatedEntityType: "account",
      relatedEntityId: a.id,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spending category spike: this 30-day window vs the 90 days before it.
// Flags categories where current spending is meaningfully higher than the
// 3-month baseline.
// ---------------------------------------------------------------------------
export function detectSpendingAnomaly(
  txns: Transaction[],
  accountMap: Map<string, Account>,
  catMap: Map<string, Category>
): DetectedFinding[] {
  const now = new Date();
  const thirtyAgo = new Date(now);
  thirtyAgo.setDate(now.getDate() - 30);
  const oneTwentyAgo = new Date(now);
  oneTwentyAgo.setDate(now.getDate() - 120);

  const thirtyIso = thirtyAgo.toISOString().slice(0, 10);
  const oneTwentyIso = oneTwentyAgo.toISOString().slice(0, 10);

  const current = new Map<string, number>();
  const baseline = new Map<string, number>();
  for (const t of txns) {
    if (t.pending) continue;
    if (!isOutflow(t, accountMap.get(t.accountId))) continue;
    if (t.date < oneTwentyIso) continue;
    const key = t.categoryKey ?? "UNCATEGORIZED";
    if (t.date >= thirtyIso) {
      current.set(key, (current.get(key) ?? 0) + t.amount);
    } else {
      baseline.set(key, (baseline.get(key) ?? 0) + t.amount);
    }
  }

  const out: DetectedFinding[] = [];
  for (const [key, curr] of current.entries()) {
    if (curr < 100) continue; // ignore noise
    const base = baseline.get(key) ?? 0;
    const baseMonthlyAvg = base / 3; // 90-day baseline → monthly average
    if (baseMonthlyAvg < 50) continue; // need a meaningful baseline
    const delta = curr - baseMonthlyAvg;
    const ratio = curr / baseMonthlyAvg;
    if (ratio < 1.5) continue; // only flag 50%+ over baseline
    const severity: FindingSeverity =
      ratio >= 2.5 ? "high" : ratio >= 1.8 ? "medium" : "low";
    const label = labelForKey(key, catMap);
    out.push({
      type: "spending_anomaly",
      signature: `anomaly:${key}:${now.toISOString().slice(0, 7)}`,
      severity,
      title: `${label} spending is up ${Math.round((ratio - 1) * 100)}% this month`,
      detail:
        `Last 30 days: ${fmt2(curr)} in ${label}. Your 3-month average was ${fmt2(baseMonthlyAvg)}/mo. ` +
        `That's ${fmt2(delta)} more than usual.`,
      suggestion:
        `Click into the Transactions tab and filter by "${label}" — the bulk-recategorize tool ` +
        `can help if some of these are mislabeled. Otherwise it's worth asking whether this spike is ` +
        `a one-time event (kid's birthday, vet visit) or a trend.`,
      amount: delta,
      relatedEntityType: "category",
      relatedEntityId: key,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Goals where the timeline is meaningfully behind progress.
// ---------------------------------------------------------------------------
export function detectGoalSlippage(goals: Goal[]): DetectedFinding[] {
  const out: DetectedFinding[] = [];
  for (const g of goals) {
    if (g.archived) continue;
    if (!g.targetDate) continue;
    const progress = computeGoalProgress(g);
    if (progress.status !== "behind") continue;
    const start = g.startingAmountDate
      ? new Date(g.startingAmountDate)
      : new Date(g.createdAt);
    const end = new Date(g.targetDate);
    const total = end.getTime() - start.getTime();
    if (total <= 0) continue;
    const elapsed = Date.now() - start.getTime();
    const timeFrac = Math.max(0, Math.min(1, elapsed / total));
    const progFrac = progress.pct ?? 0;
    const gap = timeFrac - progFrac;
    if (gap < 0.1) continue; // ignore small slips
    const severity: FindingSeverity =
      gap >= 0.3 ? "high" : gap >= 0.2 ? "medium" : "low";
    out.push({
      type: "goal_slippage",
      signature: `goal:${g.id}`,
      severity,
      title: `"${g.name}" is behind schedule`,
      detail:
        `You're ${Math.round(timeFrac * 100)}% through the timeline but only ${Math.round(progFrac * 100)}% to target. ` +
        `${progress.headline}`,
      suggestion:
        `Either bump the target date, lower the target, or increase monthly contributions. ` +
        `For retirement goals, the projection on the goal's detail page shows what current pace gets you.`,
      relatedEntityType: "goal",
      relatedEntityId: g.id,
    });
  }
  return out;
}
