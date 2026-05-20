import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

const FIELDS = ["title", "category", "forPerson", "status", "lastReviewed", "notes"];

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/estate/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const f of FIELDS) {
      if (f in body) updates[f] = body[f];
    }
    updates.updatedAt = Date.now();
    db.update(schema.estateItems)
      .set(updates)
      .where(eq(schema.estateItems.id, id))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/estate/[id]">
) {
  const { id } = await ctx.params;
  db.delete(schema.estateItems).where(eq(schema.estateItems.id, id)).run();
  return NextResponse.json({ ok: true });
}
