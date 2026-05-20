import { NextResponse } from "next/server";
import { refreshAssets } from "../search/route";

export const runtime = "nodejs";

/**
 * Force-refresh the local asset cache from Alpaca. Hit this manually if a
 * newly-listed ticker isn't showing in the typeahead.
 */
export async function POST() {
  try {
    const count = await refreshAssets();
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
