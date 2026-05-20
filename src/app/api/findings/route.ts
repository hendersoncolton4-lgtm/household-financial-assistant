import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const findings = db
    .select()
    .from(schema.findings)
    .orderBy(desc(schema.findings.updatedAt))
    .all();
  return NextResponse.json({ findings });
}
