import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

const VALID_TYPES = new Set([
  "emergency_fund",
  "debt_payoff",
  "savings",
  "retirement",
  "savings_rate",
  "custom",
]);

export async function GET() {
  const goals = db
    .select()
    .from(schema.goals)
    .orderBy(desc(schema.goals.createdAt))
    .all();
  return NextResponse.json({ goals });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.type || !VALID_TYPES.has(body.type)) {
      return NextResponse.json({ error: "Invalid goal type" }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const now = Date.now();
    const id = randomUUID();
    db.insert(schema.goals)
      .values({
        id,
        type: body.type,
        name: body.name,
        targetAmount: numOrNull(body.targetAmount),
        targetDate: strOrNull(body.targetDate),
        linkedAccountId: strOrNull(body.linkedAccountId),
        startingAmount: numOrNull(body.startingAmount),
        startingAmountDate: strOrNull(body.startingAmountDate),
        monthlyContribution: numOrNull(body.monthlyContribution),
        expectedReturnRate: numOrNull(body.expectedReturnRate),
        notes: strOrNull(body.notes),
        archived: false,
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
