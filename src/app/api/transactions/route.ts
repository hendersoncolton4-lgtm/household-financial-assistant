import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const txns = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date))
    .limit(200)
    .all();
  return NextResponse.json({ transactions: txns });
}
