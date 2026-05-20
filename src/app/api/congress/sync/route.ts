import { NextResponse } from "next/server";
import { syncCongressTrades } from "@/lib/congress";

export const runtime = "nodejs";

/**
 * Pull the full Senate + House trade datasets and upsert into our local
 * table. Returns counts; safe to re-run (deduped by content fingerprint).
 */
export async function POST() {
  try {
    const result = await syncCongressTrades();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
