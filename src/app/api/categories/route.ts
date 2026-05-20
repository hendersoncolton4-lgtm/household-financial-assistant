import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const categories = db.select().from(schema.categories).all();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    // Generate a stable key from the label. We don't expose the key in the UI,
    // but it has to be unique. Slug + timestamp suffix avoids collisions.
    const slug =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32) || "custom";
    const key = `custom_${slug}_${Date.now().toString(36)}`;
    const now = Date.now();
    db.insert(schema.categories)
      .values({
        key,
        label,
        isCustom: true,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
