import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getFundName, padCik } from "@/lib/sec";

export const runtime = "nodejs";

export async function GET() {
  const funds = db
    .select()
    .from(schema.funds)
    .orderBy(asc(schema.funds.name))
    .all();
  return NextResponse.json({ funds });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const raw = String(body.cik ?? "").replace(/\D/g, "");
    if (!raw) {
      return NextResponse.json({ error: "CIK is required" }, { status: 400 });
    }
    const padded = padCik(raw);

    let name: string;
    try {
      name = await getFundName(padded);
    } catch (err) {
      const message = err instanceof Error ? err.message : "SEC lookup failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const now = Date.now();
    db.insert(schema.funds)
      .values({
        cik: padded,
        name,
        notes: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.funds.cik,
        set: { name, updatedAt: now },
      })
      .run();
    return NextResponse.json({ ok: true, cik: padded, name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
