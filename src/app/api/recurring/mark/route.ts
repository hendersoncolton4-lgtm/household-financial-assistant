import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

const VALID_STATUSES = new Set(["cancelled", "hidden", "active"]);

/**
 * Set the status for a detected recurring pattern (identified by
 * direction + merchant). "active" clears the override — the row is
 * deleted and the pattern goes back to showing normally.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const direction = String(body.direction ?? "");
    const merchant = String(body.merchant ?? "");
    const status = String(body.status ?? "");
    const notes = typeof body.notes === "string" ? body.notes : null;

    if (direction !== "in" && direction !== "out") {
      return NextResponse.json({ error: "direction must be 'in' or 'out'" }, { status: 400 });
    }
    if (!merchant) {
      return NextResponse.json({ error: "merchant is required" }, { status: 400 });
    }
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const id = `${direction}:${merchant}`;

    if (status === "active") {
      db.delete(schema.recurringStatus)
        .where(eq(schema.recurringStatus.id, id))
        .run();
      return NextResponse.json({ ok: true, id, status: "active" });
    }

    const now = Date.now();
    db.insert(schema.recurringStatus)
      .values({
        id,
        direction,
        merchant,
        status,
        notes,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.recurringStatus.id,
        set: { status, notes, updatedAt: now },
      })
      .run();
    return NextResponse.json({ ok: true, id, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
