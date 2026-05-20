import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = db
    .select()
    .from(schema.taxContributions)
    .orderBy(desc(schema.taxContributions.year))
    .all();
  return NextResponse.json({ contributions: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const year = parseInt(String(body.year ?? new Date().getFullYear()), 10);
    const person = String(body.person ?? "");
    const accountType = String(body.accountType ?? "");
    const amount = parseFloat(String(body.amount ?? ""));
    if (!person || !accountType || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const now = Date.now();
    const id = randomUUID();
    db.insert(schema.taxContributions)
      .values({
        id,
        year,
        person,
        accountType,
        amount,
        notes: typeof body.notes === "string" ? body.notes : null,
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
