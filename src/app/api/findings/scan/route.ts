import { NextResponse } from "next/server";
import { runScan } from "@/lib/findings/scan";

export const runtime = "nodejs";

export async function POST() {
  try {
    const report = runScan();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
