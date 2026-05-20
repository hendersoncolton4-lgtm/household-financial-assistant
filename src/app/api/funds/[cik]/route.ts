import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { padCik } from "@/lib/sec";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/funds/[cik]">
) {
  try {
    const { cik } = await ctx.params;
    const padded = padCik(cik);
    // Cascade-delete all holdings and filings for this fund.
    db.delete(schema.fundHoldings)
      .where(eq(schema.fundHoldings.cik, padded))
      .run();
    db.delete(schema.fundFilings)
      .where(eq(schema.fundFilings.cik, padded))
      .run();
    db.delete(schema.funds).where(eq(schema.funds.cik, padded)).run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
