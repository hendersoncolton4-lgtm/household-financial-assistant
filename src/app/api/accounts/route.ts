import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const items = db.select().from(schema.plaidItems).all();
  const allAccounts = db.select().from(schema.accounts).all();

  const grouped = items.map((i) => ({
    id: i.id,
    institutionName: i.institutionName,
    institutionId: i.institutionId,
    createdAt: i.createdAt,
    accounts: allAccounts.filter((a) => a.itemId === i.id),
  }));

  return NextResponse.json({ items: grouped });
}
