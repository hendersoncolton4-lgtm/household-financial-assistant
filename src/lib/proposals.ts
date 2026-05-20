import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { db, schema } from "@/lib/db";
import { getAccount, getSnapshots, lookupAsset } from "@/lib/alpaca";
import { buildFinancialContext } from "@/lib/financial-context";

const TRADE_TOOL: Tool = {
  name: "propose_trade",
  description:
    "Submit a single proposed paper-trade order with reasoning. Always include both rationale and risk notes.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Uppercase US equity ticker." },
      side: { type: "string", enum: ["buy", "sell"] },
      quantity: {
        type: "number",
        description:
          "Number of shares. Be sensible — usually fractional values aren't supported; use whole numbers.",
      },
      orderType: { type: "string", enum: ["market", "limit"] },
      limitPrice: {
        type: ["number", "null"],
        description: "Limit price (required if orderType is 'limit'; null for market).",
      },
      rationale: {
        type: "string",
        description: "2–4 sentences. Why this trade? Reference data the user can verify.",
      },
      riskNotes: {
        type: "string",
        description:
          "2–3 sentences. What could go wrong? Concentration, timing, valuation, macro — be specific.",
      },
    },
    required: [
      "symbol",
      "side",
      "quantity",
      "orderType",
      "rationale",
      "riskNotes",
    ],
  },
};

export type ProposeArgs = {
  /** Constrain the AI to a specific symbol. */
  symbol?: string;
  /** Freeform user request, e.g. "find me a value play" or "trim my biggest position". */
  request?: string;
};

export type ProposeResult = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  orderType: "market" | "limit";
  limitPrice: number | null;
  rationale: string;
  riskNotes: string;
  estimatedValue: number | null;
};

/**
 * Generate a single trade proposal using Claude tool-use.
 * Caller is responsible for persisting + handling the approval queue.
 */
export async function generateProposal(args: ProposeArgs): Promise<ProposeResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  // Pull live context: paper account state + financial snapshot
  const [account, financialContext] = await Promise.all([
    getAccount(),
    Promise.resolve(buildFinancialContext()),
  ]);

  // If a specific symbol is given, fetch its current snapshot for context
  let symbolContext = "";
  if (args.symbol) {
    try {
      const upper = args.symbol.toUpperCase();
      const [asset, snaps] = await Promise.all([
        lookupAsset(upper),
        getSnapshots([upper]),
      ]);
      const snap = snaps[upper];
      if (asset && snap) {
        symbolContext = `\n\nFOCUS SYMBOL: ${upper} (${asset.name})
Latest price: $${snap.latestTradePrice?.toFixed(2) ?? "—"}
Prev close: $${snap.prevDailyClose?.toFixed(2) ?? "—"}
Change: ${snap.changePercent != null ? `${(snap.changePercent * 100).toFixed(2)}%` : "—"}
Day range: $${snap.dailyLow?.toFixed(2) ?? "—"} – $${snap.dailyHigh?.toFixed(2) ?? "—"}
Volume: ${snap.dailyVolume?.toLocaleString() ?? "—"}`;
      }
    } catch {
      // best-effort context
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  const accountBlock = `PAPER TRADING ACCOUNT (Alpaca):
  Cash: ${fmt(account.cash)}
  Buying power: ${fmt(account.buyingPower)}
  Portfolio value: ${fmt(account.portfolioValue)}
  Equity: ${fmt(account.equity)}
  Last equity (≈ yesterday): ${fmt(account.lastEquity)}
  Day P/L: ${fmt(account.equity - account.lastEquity)}`;

  const userRequest = args.request
    ? `\n\nUSER REQUEST: ${args.request}`
    : args.symbol
    ? `\n\nThe user wants a proposed trade on ${args.symbol.toUpperCase()}.`
    : "\n\nThe user wants any reasonable proposal — pick one symbol from their watchlist or holdings that makes sense right now.";

  const prompt = `You are proposing a single paper-trade order for a household.

HOUSEHOLD FINANCIAL CONTEXT (current snapshot):
${financialContext}

${accountBlock}${symbolContext}${userRequest}

RULES:
- This is PAPER trading. No real money. Still propose with the diligence you'd apply to real money.
- Size sensibly. Default to no more than 5% of buying power on a single trade unless the user explicitly asks for bigger.
- Whole-share quantities only.
- Use market orders for liquid large-cap stocks (AAPL, MSFT, VOO, etc.). Use limit orders if you want a specific entry.
- ALWAYS include risk notes. If you don't have a strong view, say so in the risk notes and propose smaller.
- If the user already has a meaningful position in the symbol, be explicit about whether you're adding to or trimming.
- If you genuinely don't think a trade makes sense right now, still propose the most defensible one and explicitly say "low conviction" in the risk notes.

Use the propose_trade tool to return your proposal.`;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools: [TRADE_TOOL],
    tool_choice: { type: "tool", name: "propose_trade" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Model did not return a structured proposal");
  }
  const args2 = toolBlock.input as Record<string, unknown>;
  const symbol = String(args2.symbol ?? "").toUpperCase();
  const side = args2.side === "sell" ? "sell" : "buy";
  const quantity = Number(args2.quantity);
  const orderType = args2.orderType === "limit" ? "limit" : "market";
  const limitPrice =
    typeof args2.limitPrice === "number" && Number.isFinite(args2.limitPrice)
      ? args2.limitPrice
      : null;
  const rationale = String(args2.rationale ?? "");
  const riskNotes = String(args2.riskNotes ?? "");

  if (!symbol || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Model returned an invalid proposal");
  }

  // Estimate value from latest snapshot if available
  let estimatedValue: number | null = null;
  try {
    const snaps = await getSnapshots([symbol]);
    const price = snaps[symbol]?.latestTradePrice ?? limitPrice ?? null;
    if (price != null) estimatedValue = price * quantity;
  } catch {
    /* best-effort */
  }

  return {
    symbol,
    side,
    quantity,
    orderType,
    limitPrice,
    rationale,
    riskNotes,
    estimatedValue,
  };
}

/**
 * Reconcile one proposal against Alpaca — used when an approved order may
 * have filled since it was submitted. Updates status/filled fields.
 */
export async function reconcileProposal(proposalId: string): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const p = db
    .select()
    .from(schema.proposals)
    .where(eq(schema.proposals.id, proposalId))
    .get();
  if (!p || !p.alpacaOrderId) return;
  const { getOrder } = await import("@/lib/alpaca");
  const order = await getOrder(p.alpacaOrderId);
  const updates: Record<string, unknown> = {
    alpacaOrderStatus: order.status,
    updatedAt: Date.now(),
  };
  if (order.status === "filled") {
    updates.status = "executed";
    updates.filledAt = order.filledAt ? Date.parse(order.filledAt) : Date.now();
    updates.filledPrice = order.filledAvgPrice;
    updates.filledQuantity = order.filledQty;
  } else if (
    order.status === "canceled" ||
    order.status === "expired" ||
    order.status === "rejected"
  ) {
    updates.status = order.status === "rejected" ? "failed" : "cancelled";
    if (order.status === "rejected") {
      updates.failureReason = order.status;
    }
  }
  db.update(schema.proposals)
    .set(updates)
    .where(eq(schema.proposals.id, proposalId))
    .run();
}
