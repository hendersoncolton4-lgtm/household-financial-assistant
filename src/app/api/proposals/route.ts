import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const proposals = db
    .select()
    .from(schema.proposals)
    .orderBy(desc(schema.proposals.createdAt))
    .all();
  return NextResponse.json({ proposals });
}
