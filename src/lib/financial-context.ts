import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { GOAL_TYPE_LABELS, type GoalType } from "@/lib/db/schema";
import { computeGoalProgress } from "@/lib/goals";

/**
 * Builds a snapshot of the household's current financial situation suitable
 * for injecting into the chat agent's context. Returns a plain string.
 */
export function buildFinancialContext(): string {
  const items = db.select().from(schema.plaidItems).all();
  const accountsList = db.select().from(schema.accounts).all();
  const recentTxns = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date))
    .limit(50)
    .all();
  const goalsList = db.select().from(schema.goals).all();

  if (accountsList.length === 0) {
    return [
      "Household financial snapshot:",
      "No accounts have been connected yet. The user is in Phase 1 setup.",
      "If they ask about specific accounts, balances, or spending, gently let them know they",
      "need to visit the Connect page (/connect) and link an account first.",
    ].join("\n");
  }

  const institutionMap = new Map(
    items.map((i) => [i.id, i.institutionName ?? "Unknown institution"])
  );

  let assets = 0;
  let liabilities = 0;
  for (const a of accountsList) {
    if (a.currentBalance == null) continue;
    if (a.type === "depository" || a.type === "investment") {
      assets += a.currentBalance;
    } else if (a.type === "credit" || a.type === "loan") {
      liabilities += a.currentBalance;
    }
  }
  const netWorth = assets - liabilities;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const accountLines = accountsList
    .map((a) => {
      const inst = institutionMap.get(a.itemId) ?? "Unknown";
      const bal = a.currentBalance == null ? "—" : fmt(a.currentBalance);
      return `  - ${inst} / ${a.name}${a.mask ? ` ••${a.mask}` : ""} (${a.subtype ?? a.type}): ${bal}`;
    })
    .join("\n");

  // 30-day totals
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  let in30 = 0;
  let out30 = 0;
  for (const t of recentTxns) {
    if (t.date < cutoffIso || t.pending) continue;
    if (t.amount < 0) in30 += -t.amount;
    else out30 += t.amount;
  }

  const txnLines = recentTxns
    .slice(0, 25)
    .map((t) => {
      const cat = t.category ? (JSON.parse(t.category) as string[]).join(" > ") : "";
      const merchant = t.merchantName ?? t.name;
      return `  - ${t.date} ${merchant} ${fmt(t.amount)}${cat ? ` [${cat}]` : ""}${t.pending ? " [pending]" : ""}`;
    })
    .join("\n");

  const activeGoals = goalsList.filter((g) => !g.archived);
  let goalsBlock = "";
  if (activeGoals.length > 0) {
    const goalLines = activeGoals
      .map((g) => {
        const p = computeGoalProgress(g);
        const pctStr = p.pct == null ? "—" : `${(p.pct * 100).toFixed(0)}%`;
        const target =
          g.type === "savings_rate" && g.targetAmount != null
            ? `${(g.targetAmount * 100).toFixed(0)}%`
            : g.targetAmount != null
            ? fmt(g.targetAmount)
            : "(no target)";
        const date = g.targetDate ? `, by ${g.targetDate}` : "";
        return `  - ${g.name} (${GOAL_TYPE_LABELS[g.type as GoalType] ?? g.type}): ${p.headline} [${pctStr}, ${p.status}] — target ${target}${date}`;
      })
      .join("\n");
    goalsBlock = `\nActive goals (${activeGoals.length}):\n${goalLines}\n`;
  } else {
    goalsBlock = `\nActive goals: none yet. If a financial discussion would benefit from a goal, suggest creating one via the Goals page (/goals/new).\n`;
  }

  return [
    "Household financial snapshot (live data, refreshed when the user hits Sync):",
    "",
    `Net worth: ${fmt(netWorth)}  (assets ${fmt(assets)} − liabilities ${fmt(liabilities)})`,
    "",
    `Connected institutions: ${items.length}. Accounts: ${accountsList.length}.`,
    accountLines,
    "",
    `Cash flow, last 30 days (excluding pending):`,
    `  Money in:  ${fmt(in30)}`,
    `  Money out: ${fmt(out30)}`,
    `  Net:       ${fmt(in30 - out30)}`,
    goalsBlock,
    `Recent transactions (latest 25 of ${recentTxns.length} loaded):`,
    txnLines,
    "",
    "Convention: positive transaction amounts represent money leaving the account (purchases, transfers out, fees). Negative amounts represent money entering the account (deposits, refunds, transfers in). This matches Plaid's API.",
  ].join("\n");
}
