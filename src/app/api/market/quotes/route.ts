import { NextRequest, NextResponse } from "next/server";
import { getSnapshots } from "@/lib/alpaca";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) {
      return NextResponse.json({ snapshots: {} });
    }
    const snapshots = await getSnapshots(symbols);
    return NextResponse.json({ snapshots });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
