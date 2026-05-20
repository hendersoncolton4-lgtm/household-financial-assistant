import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { cancelOrder } from "@/lib/alpaca";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/cancel">
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
    if (p.status !== "approved" || !p.alpacaOrderId) {
      return NextResponse.json(
        { error: "Can only cancel proposals with a live Alpaca order." },
        { status: 400 }
      );
    }
    try {
      await cancelOrder(p.alpacaOrderId);
    } catch (err) {
      // Sometimes Alpaca's cancel races with a fill; we don't treat that as
      // fatal. The sync endpoint will reconcile actual state.
      console.warn("[cancel] alpaca cancel error:", err);
    }
    db.update(schema.proposals)
      .set({ status: "cancelled", updatedAt: Date.now() })
      .where(eq(schema.proposals.id, id))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
