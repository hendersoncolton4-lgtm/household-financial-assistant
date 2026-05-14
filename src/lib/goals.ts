import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Account, Goal, GoalType, Transaction } from "@/lib/db/schema";

export type GoalProgress = {
  current: number | null;
  target: number | null;
  pct: number | null; // 0-1, may exceed 1 for "ahead"; null if not computable
  status: "achieved" | "on_track" | "behind" | "ahead" | "unknown";
  headline: string;
  detail: string;
};

/**
 * Compute current progress for a goal using live account + transaction data.
 */
export function computeGoalProgress(goal: Goal): GoalProgress {
  const accountsList = db.select().from(schema.accounts).all();
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));

  switch (goal.type as GoalType) {
    case "emergency_fund":
      return progressForBalanceGoal(goal, accountsList, accountMap, [
        "depository",
      ]);
    case "savings":
      return progressForBalanceGoal(goal, accountsList, accountMap, [
        "depository",
        "investment",
      ]);
    case "retirement":
      return progressForBalanceGoal(goal, accountsList, accountMap, [
        "investment",
      ]);
    case "debt_payoff":
      return progressForDebtPayoff(goal, accountMap);
    case "savings_rate":
      return progressForSavingsRate(goal);
    case "custom":
      return progressForCustom(goal, accountMap);
    default:
      return {
        current: null,
        target: goal.targetAmount,
        pct: null,
        status: "unknown",
        headline: "Unknown goal type",
        detail: "",
      };
  }
}

function progressForBalanceGoal(
  goal: Goal,
  accountsList: Account[],
  accountMap: Map<string, Account>,
  allowedTypes: string[]
): GoalProgress {
  let current = 0;
  let detail = "";
  if (goal.linkedAccountId) {
    const a = accountMap.get(goal.linkedAccountId);
    if (a?.currentBalance != null) {
      current = a.currentBalance;
      detail = `Tracking ${a.name}${a.mask ? ` ••${a.mask}` : ""}.`;
    }
  } else {
    const matching = accountsList.filter((a) => allowedTypes.includes(a.type));
    for (const a of matching) {
      if (a.currentBalance != null) current += a.currentBalance;
    }
    detail = `Summed across ${matching.length} ${allowedTypes.join("/")} account(s).`;
  }

  const target = goal.targetAmount ?? null;
  if (target == null || target <= 0) {
    return {
      current,
      target,
      pct: null,
      status: "unknown",
      headline: fmt(current),
      detail: `${detail} No target set.`,
    };
  }
  const pct = current / target;
  const status =
    pct >= 1 ? "achieved" : pct >= scheduleProgress(goal) ? "on_track" : "behind";
  return {
    current,
    target,
    pct,
    status,
    headline: `${fmt(current)} of ${fmt(target)}`,
    detail,
  };
}

function progressForDebtPayoff(
  goal: Goal,
  accountMap: Map<string, Account>
): GoalProgress {
  const linked = goal.linkedAccountId
    ? accountMap.get(goal.linkedAccountId)
    : null;
  if (!linked) {
    return {
      current: null,
      target: 0,
      pct: null,
      status: "unknown",
      headline: "Link a credit or loan account to track this.",
      detail: "",
    };
  }
  const current = linked.currentBalance ?? 0;
  const starting = goal.startingAmount ?? current;
  const paidOff = Math.max(0, starting - current);
  const pct = starting > 0 ? paidOff / starting : 0;
  const status =
    current <= 0 ? "achieved" : pct >= scheduleProgress(goal) ? "on_track" : "behind";
  return {
    current,
    target: 0,
    pct,
    status,
    headline:
      current <= 0
        ? `Paid off! Was ${fmt(starting)}.`
        : `${fmt(current)} remaining (paid off ${fmt(paidOff)} of ${fmt(starting)})`,
    detail: `Tracking ${linked.name}${linked.mask ? ` ••${linked.mask}` : ""}.`,
  };
}

function progressForSavingsRate(goal: Goal): GoalProgress {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const txns: Transaction[] = db
    .select()
    .from(schema.transactions)
    .where(gte(schema.transactions.date, cutoffIso))
    .all();

  let income = 0;
  let spending = 0;
  for (const t of txns) {
    if (t.pending) continue;
    if (t.amount < 0) income += -t.amount;
    else spending += t.amount;
  }
  if (income <= 0) {
    return {
      current: null,
      target: goal.targetAmount,
      pct: null,
      status: "unknown",
      headline: "No income detected in the last 30 days.",
      detail: "Connect a checking account that receives deposits, or hit Sync.",
    };
  }
  const saved = income - spending;
  const rate = saved / income;
  const target = goal.targetAmount ?? null;
  const pct = target != null && target > 0 ? rate / target : null;
  const status =
    target == null
      ? "unknown"
      : rate >= target
      ? "on_track"
      : "behind";
  return {
    current: rate,
    target,
    pct,
    status,
    headline: `${(rate * 100).toFixed(1)}%${target != null ? ` of ${(target * 100).toFixed(0)}% target` : ""}`,
    detail: `Last 30 days: ${fmt(income)} in, ${fmt(spending)} out, ${fmt(saved)} saved.`,
  };
}

function progressForCustom(
  goal: Goal,
  accountMap: Map<string, Account>
): GoalProgress {
  let current = 0;
  let detail = "";
  if (goal.linkedAccountId) {
    const a = accountMap.get(goal.linkedAccountId);
    if (a?.currentBalance != null) {
      current = a.currentBalance;
      detail = `Tracking ${a.name}.`;
    }
  } else if (goal.startingAmount != null) {
    current = goal.startingAmount;
    detail = "Manual starting amount (link an account to auto-update).";
  } else {
    detail = "No account linked.";
  }
  const target = goal.targetAmount ?? null;
  const pct = target != null && target > 0 ? current / target : null;
  const status =
    pct == null ? "unknown" : pct >= 1 ? "achieved" : "on_track";
  return {
    current,
    target,
    pct,
    status,
    headline:
      target != null
        ? `${fmt(current)} of ${fmt(target)}`
        : fmt(current),
    detail,
  };
}

/**
 * If the goal has a starting date and target date, returns the % of the
 * timeline that has elapsed. Used to determine "on track" vs "behind".
 */
function scheduleProgress(goal: Goal): number {
  if (!goal.targetDate) return 0;
  const start = goal.startingAmountDate
    ? new Date(goal.startingAmountDate)
    : new Date(goal.createdAt);
  const end = new Date(goal.targetDate);
  const now = new Date();
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 1;
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(1, elapsed / total));
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/**
 * Compute future value with monthly compounding.
 *   FV = PV * (1+r)^n + PMT * ((1+r)^n - 1) / r
 * @param presentValue starting balance
 * @param monthlyContribution monthly deposit (in same currency)
 * @param annualReturnRate e.g. 0.07 for 7%
 * @param years time horizon in years
 */
export function projectFutureValue(
  presentValue: number,
  monthlyContribution: number,
  annualReturnRate: number,
  years: number
): number {
  const r = annualReturnRate / 12;
  const n = Math.round(years * 12);
  if (r === 0) {
    return presentValue + monthlyContribution * n;
  }
  const growth = Math.pow(1 + r, n);
  return presentValue * growth + monthlyContribution * ((growth - 1) / r);
}

/**
 * Solve for years needed to reach a target given PV, PMT, r.
 * Returns null if unreachable (target < PV and PMT non-negative, etc.).
 */
export function yearsToReach(
  presentValue: number,
  monthlyContribution: number,
  annualReturnRate: number,
  target: number
): number | null {
  if (target <= presentValue) return 0;
  const r = annualReturnRate / 12;
  if (r === 0) {
    if (monthlyContribution <= 0) return null;
    return (target - presentValue) / monthlyContribution / 12;
  }
  if (monthlyContribution + presentValue * r <= 0 && target > presentValue) {
    return null;
  }
  const numerator = target * r + monthlyContribution;
  const denominator = presentValue * r + monthlyContribution;
  if (denominator <= 0) return null;
  const n = Math.log(numerator / denominator) / Math.log(1 + r);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 12;
}

export function recentGoals(limit = 50): Goal[] {
  return db
    .select()
    .from(schema.goals)
    .orderBy(desc(schema.goals.createdAt))
    .limit(limit)
    .all();
}
