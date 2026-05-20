import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/watchlist/[symbol]">
) {
  try {
    const { symbol } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.notes === "string") updates.notes = body.notes;
    updates.updatedAt = Date.now();
    db.update(schema.watchlist)
      .set(updates)
      .where(eq(schema.watchlist.symbol, symbol.toUpperCase()))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/watchlist/[symbol]">
) {
  const { symbol } = await ctx.params;
  db.delete(schema.watchlist).where(eq(schema.watchlist.symbol, symbol.toUpperCase())).run();
  return NextResponse.json({ ok: true });
}
