import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/goals/[id]">) {
  const { id } = await ctx.params;
  const row = db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.id, id))
    .get();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ goal: row });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/goals/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    const fields = [
      "name",
      "targetAmount",
      "targetDate",
      "linkedAccountId",
      "startingAmount",
      "startingAmountDate",
      "monthlyContribution",
      "expectedReturnRate",
      "notes",
      "archived",
    ];
    for (const f of fields) {
      if (f in body) updates[f] = body[f];
    }
    updates.updatedAt = Date.now();
    db.update(schema.goals)
      .set(updates)
      .where(eq(schema.goals.id, id))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/goals/[id]">) {
  const { id } = await ctx.params;
  db.delete(schema.goals).where(eq(schema.goals.id, id)).run();
  return NextResponse.json({ ok: true });
}
