import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { HOUSEHOLD_PROFILE_ID } from "@/lib/planning";

export const runtime = "nodejs";

export async function GET() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get();
  return NextResponse.json({ profile });
}

const FIELDS = [
  "primaryName",
  "primaryDob",
  "secondaryName",
  "secondaryDob",
  "filingStatus",
  "state",
  "numberOfDependents",
  "primaryAnnualIncome",
  "secondaryAnnualIncome",
  "primaryEmployerMatchPercent",
  "primaryEmployerMatchUpTo",
  "secondaryEmployerMatchPercent",
  "secondaryEmployerMatchUpTo",
  "hsaEligible",
  "hsaCoverageType",
  "notes",
];

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const now = Date.now();
    const existing = db
      .select()
      .from(schema.profile)
      .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
      .get();

    const updates: Record<string, unknown> = {};
    for (const f of FIELDS) {
      if (f in body) updates[f] = body[f];
    }

    if (existing) {
      updates.updatedAt = now;
      db.update(schema.profile)
        .set(updates)
        .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
        .run();
    } else {
      db.insert(schema.profile)
        .values({
          id: HOUSEHOLD_PROFILE_ID,
          hsaEligible: false,
          ...updates,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
