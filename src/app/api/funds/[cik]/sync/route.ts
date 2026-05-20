import { NextRequest, NextResponse } from "next/server";
import { padCik } from "@/lib/sec";
import { syncFundFilings } from "@/lib/funds";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/funds/[cik]/sync">
) {
  try {
    const { cik } = await ctx.params;
    const padded = padCik(cik);
    const result = await syncFundFilings(padded, 4);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
