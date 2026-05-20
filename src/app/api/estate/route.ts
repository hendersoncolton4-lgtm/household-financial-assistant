import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = db
    .select()
    .from(schema.estateItems)
    .orderBy(asc(schema.estateItems.sortOrder), asc(schema.estateItems.createdAt))
    .all();
  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "other");
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const now = Date.now();
    const id = randomUUID();
    db.insert(schema.estateItems)
      .values({
        id,
        title,
        category,
        forPerson: typeof body.forPerson === "string" ? body.forPerson : null,
        status: "not_started",
        isSeeded: false,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 1000,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
