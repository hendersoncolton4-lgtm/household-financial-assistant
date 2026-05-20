import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

const VALID_STATUSES = new Set(["new", "dismissed", "acted", "snoozed"]);

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/findings/[id]">
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const status = typeof body.status === "string" ? body.status : null;
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { status, updatedAt: Date.now() };

    if (status === "snoozed") {
      // Default snooze: 30 days.
      const snoozeDays = typeof body.snoozeDays === "number" ? body.snoozeDays : 30;
      updates.snoozedUntil = Date.now() + snoozeDays * 24 * 3600 * 1000;
    } else {
      // Clear the snooze when leaving snooze state.
      updates.snoozedUntil = null;
    }

    db.update(schema.findings)
      .set(updates)
      .where(eq(schema.findings.id, id))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
