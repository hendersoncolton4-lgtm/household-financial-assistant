import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { padCik } from "@/lib/sec";
import { getAccount, getSnapshots } from "@/lib/alpaca";

export const runtime = "nodejs";

/**
 * Generate paper-trade proposals to mimic a fund's top N holdings,
 * proportional to a target dollar allocation from the user's paper buying
 * power. Proposals land in the approval queue at /trading — nothing
 * executes automatically.
 *
 * Body:
 *   topN         (default 10)   — how many top positions to include
 *   allocation   (default 0.10) — fraction of paper buying power to deploy
 */
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/funds/[cik]/mimic">
) {
  try {
    const { cik } = await ctx.params;
    const padded = padCik(cik);
    const body = await req.json().catch(() => ({}));
    const topN = clamp(Number(body.topN ?? 10), 1, 30);
    const allocation = clamp(Number(body.allocation ?? 0.1), 0.01, 1);

    const fund = db
      .select()
      .from(schema.funds)
      .where(eq(schema.funds.cik, padded))
      .get();
    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }
    const latestFiling = db
      .select()
      .from(schema.fundFilings)
      .where(eq(schema.fundFilings.cik, padded))
      .orderBy(desc(schema.fundFilings.reportDate))
      .limit(1)
      .get();
    if (!latestFiling) {
      return NextResponse.json(
        { error: "No filings synced yet — hit Sync first." },
        { status: 400 }
      );
    }
    const topHoldings = db
      .select()
      .from(schema.fundHoldings)
      .where(eq(schema.fundHoldings.filingId, latestFiling.id))
      .all()
      .filter((h) => h.ticker) // can't trade what we couldn't resolve
      .sort((a, b) => b.pctOfPortfolio - a.pctOfPortfolio)
      .slice(0, topN);

    if (topHoldings.length === 0) {
      return NextResponse.json(
        {
          error:
            "No tradable tickers found in this filing — most names couldn't be resolved to tickers.",
        },
        { status: 400 }
      );
    }

    const account = await getAccount();
    const totalBudget = account.buyingPower * allocation;

    // Re-normalize percentages across the chosen top N so they sum to 1.
    const topTotalPct = topHoldings.reduce((s, h) => s + h.pctOfPortfolio, 0);

    // Get live prices for sizing
    const tickers = topHoldings.map((h) => h.ticker!.toUpperCase());
    let snapshots: Record<string, { latestTradePrice: number | null }> = {};
    try {
      snapshots = await getSnapshots(tickers);
    } catch (err) {
      console.warn("[mimic] snapshot fetch failed:", err);
    }

    const proposalsCreated: Array<{ symbol: string; quantity: number }> = [];
    const skipped: Array<{ symbol: string; reason: string }> = [];

    const now = Date.now();
    for (const h of topHoldings) {
      const symbol = h.ticker!.toUpperCase();
      const price = snapshots[symbol]?.latestTradePrice;
      if (!price || price <= 0) {
        skipped.push({ symbol, reason: "no live price" });
        continue;
      }
      const targetWeight = h.pctOfPortfolio / topTotalPct;
      const targetDollars = totalBudget * targetWeight;
      const quantity = Math.floor(targetDollars / price);
      if (quantity < 1) {
        skipped.push({ symbol, reason: `below 1 share at $${price.toFixed(2)}` });
        continue;
      }

      const rationale = `Mimicking ${fund.name}'s position. They held ${h.shares.toLocaleString()} shares as of ${latestFiling.reportDate} (${(h.pctOfPortfolio * 100).toFixed(2)}% of their reported portfolio). Sizing here is ${(targetWeight * 100).toFixed(1)}% of the ${Math.round(allocation * 100)}% allocation budget (${quantity} share${quantity === 1 ? "" : "s"} @ ~$${price.toFixed(2)}).`;
      const riskNotes = `13F filings are filed ~45 days after quarter-end, so this position is up to 4+ months stale — the fund may have already exited or trimmed. Copy-trading institutional 13Fs doesn't capture mid-quarter trades, options, shorts, or non-US holdings. Treat as research input, not strategy.`;

      db.insert(schema.proposals)
        .values({
          id: randomUUID(),
          symbol,
          side: "buy",
          orderType: "market",
          quantity,
          limitPrice: null,
          timeInForce: "day",
          estimatedValue: price * quantity,
          rationale,
          riskNotes,
          generatedBy: "ai",
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      proposalsCreated.push({ symbol, quantity });
    }

    return NextResponse.json({
      ok: true,
      created: proposalsCreated.length,
      proposals: proposalsCreated,
      skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
