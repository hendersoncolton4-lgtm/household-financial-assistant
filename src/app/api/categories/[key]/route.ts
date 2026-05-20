import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/categories/[key]">
) {
  try {
    const { key } = await ctx.params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.label === "string" && body.label.trim()) {
      updates.label = body.label.trim();
    }
    if (typeof body.archived === "boolean") {
      updates.archived = body.archived;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    updates.updatedAt = Date.now();
    db.update(schema.categories)
      .set(updates)
      .where(eq(schema.categories.key, key))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/categories/[key]">
) {
  try {
    const { key } = await ctx.params;
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.key, key))
      .get();
    if (!cat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Only custom categories can be hard-deleted. Plaid-seeded ones must
    // stay because existing transactions reference their keys.
    if (!cat.isCustom) {
      return NextResponse.json(
        { error: "Built-in Plaid categories can't be deleted. Archive instead." },
        { status: 400 }
      );
    }
    // If any transactions are using this custom category, refuse delete to
    // avoid orphan references. User should reassign first.
    const inUse = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.categoryKey, key))
      .limit(1)
      .all();
    if (inUse.length > 0) {
      return NextResponse.json(
        { error: "Category is in use by one or more transactions. Reassign them first or archive instead." },
        { status: 400 }
      );
    }
    // Also clean up any rules pointing at this category.
    db.delete(schema.categoryRules)
      .where(eq(schema.categoryRules.categoryKey, key))
      .run();
    db.delete(schema.categories)
      .where(eq(schema.categories.key, key))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
