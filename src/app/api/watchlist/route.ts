import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { lookupAsset } from "@/lib/alpaca";

export const runtime = "nodejs";

export async function GET() {
  const rows = db
    .select()
    .from(schema.watchlist)
    .orderBy(asc(schema.watchlist.symbol))
    .all();
  return NextResponse.json({ watchlist: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = String(body.symbol ?? "").toUpperCase().trim();
    if (!symbol || !/^[A-Z.\-]{1,10}$/.test(symbol)) {
      return NextResponse.json(
        { error: "Symbol must be 1-10 uppercase letters." },
        { status: 400 }
      );
    }
    // Validate against Alpaca so we don't add garbage tickers.
    let name: string | null = null;
    try {
      const asset = await lookupAsset(symbol);
      if (!asset) {
        return NextResponse.json(
          { error: `${symbol} isn't a recognized Alpaca-tradable symbol.` },
          { status: 400 }
        );
      }
      name = asset.name;
    } catch (err) {
      // If Alpaca lookup fails (e.g., missing keys), still let the user add
      // the symbol — we just won't have a name. Surface the underlying error
      // so they can fix env config.
      const message = err instanceof Error ? err.message : "Alpaca lookup failed";
      console.warn("[watchlist] asset lookup failed:", message);
    }

    const now = Date.now();
    db.insert(schema.watchlist)
      .values({
        symbol,
        name,
        notes: typeof body.notes === "string" ? body.notes : null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.watchlist.symbol,
        set: { name, updatedAt: now },
      })
      .run();
    return NextResponse.json({ ok: true, symbol, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
