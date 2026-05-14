import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { buildFinancialContext } from "@/lib/financial-context";
import { computeGoalProgress } from "@/lib/goals";

export const runtime = "nodejs";

export async function GET() {
  const reviews = db
    .select()
    .from(schema.monthlyReviews)
    .orderBy(desc(schema.monthlyReviews.periodEnd))
    .all();
  return NextResponse.json({ reviews });
}

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const periodStart = start.toISOString().slice(0, 10);
    const periodEnd = end.toISOString().slice(0, 10);

    const accountsList = db.select().from(schema.accounts).all();
    const txns = db
      .select()
      .from(schema.transactions)
      .where(gte(schema.transactions.date, periodStart))
      .orderBy(desc(schema.transactions.date))
      .all();

    let assets = 0;
    let liabilities = 0;
    for (const a of accountsList) {
      if (a.currentBalance == null) continue;
      if (a.type === "depository" || a.type === "investment") assets += a.currentBalance;
      else if (a.type === "credit" || a.type === "loan") liabilities += a.currentBalance;
    }
    const netWorth = assets - liabilities;

    let inflow = 0;
    let outflow = 0;
    for (const t of txns) {
      if (t.pending) continue;
      if (t.amount < 0) inflow += -t.amount;
      else outflow += t.amount;
    }

    const goalsList = db.select().from(schema.goals).all();
    const goalsSummary = goalsList
      .filter((g) => !g.archived)
      .map((g) => {
        const p = computeGoalProgress(g);
        const pctStr = p.pct == null ? "—" : `${(p.pct * 100).toFixed(0)}%`;
        return `- ${g.name} (${g.type}): ${p.headline} [${pctStr}, ${p.status}]`;
      })
      .join("\n");

    const context = buildFinancialContext();

    const reviewPrompt = `You are writing a monthly financial review for a household. Use the data below to produce a candid, useful 30-day review.

PERIOD: ${periodStart} to ${periodEnd}

CURRENT SNAPSHOT:
${context}

GOALS (status as of today):
${goalsSummary || "(no goals set yet — gently suggest setting 1-3 starter goals)"}

Write the review in clean Markdown with these sections, in this order:
## Headline — one sentence summary of the 30 days
## Net worth & cash flow — exact numbers, what moved, why if obvious
## Spending highlights — top 3-5 categories or merchants by dollars, with anything notable
## Goal progress — one line per goal: on track, ahead, behind, or achieved
## Wins — 1-3 things to feel good about
## Watchlist — 1-3 things to keep an eye on (fees, growing categories, idle cash, etc.)
## Suggested next steps — 2-4 concrete actions (not vague advice) the household could take this month
## Talk to a pro? — if anything here warrants a CPA, attorney, or fee-only fiduciary call, say so and explain why; otherwise say "Nothing in this review needs a professional."

Be specific with dollar amounts. Be honest about uncertainty. If the data is thin (e.g., a brand-new account with no history), say so explicitly rather than inventing trends.`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: reviewPrompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const content = textBlock && textBlock.type === "text" ? textBlock.text : "";

    const id = randomUUID();
    db.insert(schema.monthlyReviews)
      .values({
        id,
        periodStart,
        periodEnd,
        content,
        netWorthSnapshot: netWorth,
        inflowSnapshot: inflow,
        outflowSnapshot: outflow,
        createdAt: Date.now(),
      })
      .run();

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
