import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { merchantKey } from "@/lib/categories";

export const runtime = "nodejs";

/**
 * Update a transaction's category. Supported body fields:
 *   - categoryKey (required): the new category to apply
 *   - applyToMerchant (optional): also bulk-update other transactions from
 *     the same merchant + save a rule for future syncs
 *   - amountMin, amountMax (optional, only with applyToMerchant): restrict
 *     the rule + bulk update to transactions whose ABSOLUTE amount falls in
 *     [min, max]. Either bound may be null. Use these to create split rules
 *     like "Phillips 66 ≥ $20 → Gas, < $20 → Snacks".
 */
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/transactions/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const categoryKey = typeof body.categoryKey === "string" ? body.categoryKey : null;
    const applyToMerchant = body.applyToMerchant === true;
    const amountMin = numOrNull(body.amountMin);
    const amountMax = numOrNull(body.amountMax);
    if (!categoryKey) {
      return NextResponse.json(
        { error: "categoryKey is required" },
        { status: 400 }
      );
    }

    const txn = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, id))
      .get();
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Verify category exists
    const cat = db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.key, categoryKey))
      .get();
    if (!cat) {
      return NextResponse.json({ error: "Category not found" }, { status: 400 });
    }

    if (!applyToMerchant) {
      db.update(schema.transactions)
        .set({ categoryKey })
        .where(eq(schema.transactions.id, id))
        .run();
      return NextResponse.json({ ok: true, updated: 1, ruleSaved: false });
    }

    const mKey = merchantKey(txn);
    const now = Date.now();

    // SQLite has no native ABS in Drizzle helpers, so we filter in JS for the
    // bulk update. This is fine for hundreds-of-thousands of rows; rebuild
    // later if it gets slow.
    const merchantTxns = txn.merchantName
      ? db
          .select()
          .from(schema.transactions)
          .where(eq(schema.transactions.merchantName, txn.merchantName))
          .all()
      : db
          .select()
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.name, txn.name),
              isNull(schema.transactions.merchantName)
            )
          )
          .all();

    let updatedCount = 0;
    for (const m of merchantTxns) {
      const amt = Math.abs(m.amount);
      if (amountMin != null && amt < amountMin) continue;
      if (amountMax != null && amt > amountMax) continue;
      db.update(schema.transactions)
        .set({ categoryKey })
        .where(eq(schema.transactions.id, m.id))
        .run();
      updatedCount++;
    }

    // Upsert a rule with the same bounds. "Same rule" = same merchant +
    // same min + same max (NULL-aware). If found, update its category; else
    // insert.
    const existing = db
      .select()
      .from(schema.categoryRules)
      .where(eq(schema.categoryRules.merchantKey, mKey))
      .all();
    const dup = existing.find(
      (r) => r.amountMin === amountMin && r.amountMax === amountMax
    );
    if (dup) {
      db.update(schema.categoryRules)
        .set({ categoryKey, updatedAt: now })
        .where(eq(schema.categoryRules.id, dup.id))
        .run();
    } else {
      db.insert(schema.categoryRules)
        .values({
          id: randomUUID(),
          merchantKey: mKey,
          amountMin,
          amountMax,
          categoryKey,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return NextResponse.json({
      ok: true,
      updated: updatedCount,
      ruleSaved: true,
      ruleBounds: { min: amountMin, max: amountMax },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
