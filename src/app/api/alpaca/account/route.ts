import { NextResponse } from "next/server";
import { getAccount } from "@/lib/alpaca";

export const runtime = "nodejs";

export async function GET() {
  try {
    const account = await getAccount();
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
