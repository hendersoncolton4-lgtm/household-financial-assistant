import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Bulk-set categoryKey on a list of transaction IDs. Used by the bulk
 * action bar on the Transactions page. Intentionally does NOT create
 * per-merchant rules — the user can do that on a per-row basis if they
 * want pattern learning.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String) : null;
    const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : null;
    if (!ids || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    if (!categoryKey) {
      return NextResponse.json({ error: "categoryKey is required" }, { status: 400 });
    }
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.key, categoryKey))
      .get();
    if (!cat) {
      return NextResponse.json({ error: "Category not found" }, { status: 400 });
    }
    const result = db
      .update(schema.transactions)
      .set({ categoryKey })
      .where(inArray(schema.transactions.id, ids))
      .run();
    return NextResponse.json({ ok: true, updated: result.changes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
