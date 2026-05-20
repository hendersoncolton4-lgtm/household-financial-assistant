import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { getNews, getRecentBars, getSnapshots, lookupAsset } from "@/lib/alpaca";

export const runtime = "nodejs";

/**
 * Generate an AI investment thesis for one ticker. Pulls live snapshot +
 * recent bars + recent news from Alpaca, feeds them to Claude, and stores
 * the result. NOT investment advice — system prompt makes that clear.
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }
  try {
    const body = await req.json();
    const symbol = String(body.symbol ?? "").toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });
    }

    // Pull live data in parallel
    const [asset, snapshots, bars, news] = await Promise.all([
      lookupAsset(symbol),
      getSnapshots([symbol]),
      getRecentBars(symbol, 10).catch(() => []),
      getNews([symbol], 10).catch(() => []),
    ]);
    const snap = snapshots[symbol];
    if (!asset || !snap) {
      return NextResponse.json(
        { error: `Couldn't pull market data for ${symbol}. Check the symbol or your Alpaca keys.` },
        { status: 400 }
      );
    }

    const fmt2 = (n: number) =>
      n.toLocaleString("en-US", { style: "currency", currency: "USD" });

    const priceBlock = [
      `Latest trade: ${snap.latestTradePrice != null ? fmt2(snap.latestTradePrice) : "—"}`,
      `Daily: open ${snap.dailyOpen ?? "—"}, high ${snap.dailyHigh ?? "—"}, low ${snap.dailyLow ?? "—"}, close ${snap.dailyClose ?? "—"}`,
      `Prev close: ${snap.prevDailyClose ?? "—"}`,
      `Change: ${snap.changeAmount != null ? `${snap.changeAmount.toFixed(2)} (${snap.changePercent != null ? (snap.changePercent * 100).toFixed(2) + "%" : "—"})` : "—"}`,
    ].join("\n");

    const barLines = bars
      .map(
        (b) =>
          `  ${b.date.slice(0, 10)}: O ${b.open.toFixed(2)} H ${b.high.toFixed(2)} L ${b.low.toFixed(2)} C ${b.close.toFixed(2)} V ${b.volume.toLocaleString()}`
      )
      .join("\n");

    const newsLines = news
      .slice(0, 10)
      .map(
        (n) =>
          `  - [${n.createdAt.slice(0, 10)}] ${n.headline}${n.summary ? `\n    ${n.summary}` : ""}`
      )
      .join("\n");

    const prompt = `Write an investment thesis for ${symbol} (${asset.name}) using the live market data below. Be specific, candid, and short — under 400 words.

PRICE
${priceBlock}

LAST ${bars.length} DAILY BARS
${barLines || "  (no bar data)"}

RECENT NEWS HEADLINES
${newsLines || "  (no recent news in feed)"}

Output format (Markdown):

## Snapshot
One paragraph summarizing what the data above shows. Reference actual numbers from the snapshot.

## Bull case
2–4 bullet points. The strongest arguments FOR holding/buying, grounded in what's in the data or commonly understood about this company. If you're inferring from your training data, say so.

## Bear case
2–4 bullet points. The strongest arguments AGAINST. Take this seriously — a flat or one-sided thesis isn't useful.

## Key questions
2–3 bullet points. The questions a person should answer before sizing a position.

## What to watch
1–2 sentences. Concrete data points or events that would change your view.

Rules:
- This is NOT investment advice. End with one short sentence reminding the user this is research, not a recommendation, and that they should consult a fee-only fiduciary for sizing decisions or anything material.
- Don't make up specific numbers (revenue, EPS, growth rates) you aren't given. If you're working from general training-data knowledge of the company, say "based on what's been publicly reported through my training cutoff."
- Be honest about uncertainty. "I don't know" or "this depends on…" is better than confident bullshit.`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const content = textBlock && textBlock.type === "text" ? textBlock.text : "";

    const id = randomUUID();
    db.insert(schema.theses)
      .values({
        id,
        symbol,
        content,
        authorType: "ai",
        priceSnapshot: snap.latestTradePrice ?? null,
        newsHeadlineCount: news.length,
        createdAt: Date.now(),
      })
      .run();

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
