import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tax-contributions/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const f of ["year", "person", "accountType", "amount", "notes"]) {
      if (f in body) updates[f] = body[f];
    }
    updates.updatedAt = Date.now();
    db.update(schema.taxContributions)
      .set(updates)
      .where(eq(schema.taxContributions.id, id))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/tax-contributions/[id]">
) {
  const { id } = await ctx.params;
  db.delete(schema.taxContributions)
    .where(eq(schema.taxContributions.id, id))
    .run();
  return NextResponse.json({ ok: true });
}
