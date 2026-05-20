import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/proposals/[id]/reject">
) {
  try {
    const { id } = await ctx.params;
    const p = db
      .select()
      .from(schema.proposals)
      .where(eq(schema.proposals.id, id))
      .get();
    if (!p) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (p.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject a proposal in '${p.status}' state.` },
        { status: 400 }
      );
    }
    db.update(schema.proposals)
      .set({ status: "rejected", updatedAt: Date.now() })
      .where(eq(schema.proposals.id, id))
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
