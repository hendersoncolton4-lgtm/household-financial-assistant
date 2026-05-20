import { NextRequest, NextResponse } from "next/server";
import { and, eq, like, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listActiveAssets } from "@/lib/alpaca";

export const runtime = "nodejs";

const MAX_RESULTS = 12;
const REFRESH_THRESHOLD_DAYS = 30;

/**
 * Typeahead search. If the local cache is empty (or stale), refreshes from
 * Alpaca on the fly. Search prefers exact-symbol-match > symbol-prefix > name-substring.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (!q) return NextResponse.json({ results: [] });

    await ensureCacheFresh();

    const upper = q.toUpperCase();
    const lower = q.toLowerCase();

    // 1. Exact symbol match
    const exact = db
      .select()
      .from(schema.assets)
      .where(and(eq(schema.assets.symbol, upper), eq(schema.assets.tradable, true)))
      .limit(1)
      .all();

    // 2. Symbol prefix match
    const prefix = db
      .select()
      .from(schema.assets)
      .where(
        and(
          like(schema.assets.symbol, `${upper}%`),
          eq(schema.assets.tradable, true)
        )
      )
      .limit(MAX_RESULTS)
      .all();

    // 3. Name substring match (case-insensitive)
    const byName = db
      .select()
      .from(schema.assets)
      .where(
        and(
          sql`LOWER(${schema.assets.name}) LIKE ${`%${lower}%`}`,
          eq(schema.assets.tradable, true)
        )
      )
      .limit(MAX_RESULTS)
      .all();

    // Merge unique, in priority order
    const seen = new Set<string>();
    const results: typeof exact = [];
    for (const list of [exact, prefix, byName]) {
      for (const a of list) {
        if (seen.has(a.symbol)) continue;
        seen.add(a.symbol);
        results.push(a);
        if (results.length >= MAX_RESULTS) break;
      }
      if (results.length >= MAX_RESULTS) break;
    }

    return NextResponse.json({
      results: results.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function ensureCacheFresh() {
  const row = db
    .select({ updatedAt: schema.assets.updatedAt })
    .from(schema.assets)
    .limit(1)
    .all();
  const stale =
    row.length === 0 ||
    Date.now() - row[0].updatedAt > REFRESH_THRESHOLD_DAYS * 24 * 3600 * 1000;
  if (!stale) return;
  await refreshAssets();
}

export async function refreshAssets() {
  const all = await listActiveAssets();
  const now = Date.now();
  // Wrap in a transaction so a partial fetch doesn't leave the cache half-baked
  const insertStmt = db.insert(schema.assets);
  // Bulk insert with onConflictDoUpdate so existing rows refresh.
  // Drizzle's better-sqlite3 driver supports multi-row .values() arrays.
  // Chunk to avoid SQL variable limits.
  const chunkSize = 200;
  for (let i = 0; i < all.length; i += chunkSize) {
    const slice = all.slice(i, i + chunkSize);
    insertStmt
      .values(
        slice.map((a) => ({
          symbol: a.symbol,
          name: a.name,
          exchange: a.exchange,
          assetClass: "us_equity",
          tradable: a.tradable,
          status: a.status,
          updatedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: schema.assets.symbol,
        set: {
          name: sql.raw("excluded.name"),
          exchange: sql.raw("excluded.exchange"),
          tradable: sql.raw("excluded.tradable"),
          status: sql.raw("excluded.status"),
          updatedAt: now,
        },
      })
      .run();
  }
  return all.length;
}
