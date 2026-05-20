import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = db.select().from(schema.insurancePolicies).all();
  return NextResponse.json({ policies: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type ?? "");
    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }
    const now = Date.now();
    const id = randomUUID();
    db.insert(schema.insurancePolicies)
      .values({
        id,
        type,
        insuredName: strOrNull(body.insuredName),
        carrier: strOrNull(body.carrier),
        coverageAmount: numOrNull(body.coverageAmount),
        premiumMonthly: numOrNull(body.premiumMonthly),
        beneficiary: strOrNull(body.beneficiary),
        notes: strOrNull(body.notes),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return NextResponse.json({ ok: true, id });
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
function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}
