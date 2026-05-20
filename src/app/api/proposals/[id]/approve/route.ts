import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { submitOrder } from "@/lib/alpaca";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/approve">
) {
  try {
    const { id } = await ctx.params;
    const p = db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, id))
      .get();
    if (!p) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (p.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot approve a proposal in '${p.status}' state.` },
        { status: 400 }
      );
    }

    // Submit to Alpaca paper-trading account.
    let order;
    try {
      order = await submitOrder({
        symbol: p.symbol,
        qty: p.quantity,
        side: p.side as "buy" | "sell",
        type: p.orderType as "market" | "limit",
        timeInForce: p.timeInForce as "day" | "gtc",
        limitPrice: p.limitPrice ?? undefined,
      });
    } catch (submitErr) {
      const message =
        submitErr instanceof Error ? submitErr.message : "Submission failed";
      db.update(schema.proposals)
        .set({
          status: "failed",
          failureReason: message,
          updatedAt: Date.now(),
        })
        .where(eq(schema.proposals.id, id))
        .run();
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      alpacaOrderId: order.id,
      alpacaOrderStatus: order.status,
      updatedAt: now,
    };
    // Market orders often fill instantly during market hours. Reflect that
    // immediately so the user sees the result without needing to sync.
    if (order.status === "filled") {
      updates.status = "executed";
      updates.filledAt = order.filledAt ? Date.parse(order.filledAt) : now;
      updates.filledPrice = order.filledAvgPrice;
      updates.filledQuantity = order.filledQty;
    } else {
      updates.status = "approved";
    }

    db.update(schema.proposals)
      .set(updates)
      .where(eq(schema.proposals.id, id))
      .run();

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderStatus: order.status,
      filledQty: order.filledQty,
      filledAvgPrice: order.filledAvgPrice,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
