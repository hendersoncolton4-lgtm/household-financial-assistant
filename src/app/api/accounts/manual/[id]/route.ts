import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

const UPDATABLE = [
  "name",
  "currentBalance",
  "interestRate",
  "monthlyPayment",
  "originalPrincipal",
  "lenderName",
  "notes",
];

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/accounts/manual/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const f of UPDATABLE) {
      if (f in body) updates[f] = body[f];
    }
    updates.updatedAt = Date.now();
    db.update(schema.accounts)
      .set(updates)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.source, "manual")))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/accounts/manual/[id]">
) {
  const { id } = await ctx.params;
  db.delete(schema.accounts)
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.source, "manual")))
    .run();
  return NextResponse.json({ ok: true });
}
