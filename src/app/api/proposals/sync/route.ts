import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { reconcileProposal } from "@/lib/proposals";

export const runtime = "nodejs";

/** Reconcile any approved-but-not-finalized proposals against Alpaca. */
export async function POST() {
  try {
    const pending = db
      .select()
      .from(schema.proposals)
      .where(
        and(
          eq(schema.proposals.status, "approved"),
          inArray(schema.proposals.alpacaOrderStatus, [
            "new",
            "pending_new",
            "accepted",
            "partially_filled",
          ])
        )
      )
      .all();
    let reconciled = 0;
    for (const p of pending) {
      try {
        await reconcileProposal(p.id);
        reconciled++;
      } catch (err) {
        console.warn("[sync proposals]", p.id, err);
      }
    }
    return NextResponse.json({ ok: true, checked: pending.length, reconciled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
