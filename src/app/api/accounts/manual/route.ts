import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import {
  MANUAL_ITEM_ID,
  MANUAL_CATEGORY_LABELS,
  manualCategoryToTypeSubtype,
  type ManualCategory,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = body.category as ManualCategory;
    if (!category || !(category in MANUAL_CATEGORY_LABELS)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const balance = numOrNull(body.currentBalance);
    if (balance == null) {
      return NextResponse.json({ error: "Current balance is required" }, { status: 400 });
    }

    const { type, subtype } = manualCategoryToTypeSubtype(category);
    const id = randomUUID();

    db.insert(schema.accounts)
      .values({
        id,
        itemId: MANUAL_ITEM_ID,
        source: "manual",
        name: body.name,
        officialName: null,
        type,
        subtype,
        mask: null,
        currentBalance: balance,
        availableBalance: null,
        isoCurrencyCode: "USD",
        interestRate: numOrNull(body.interestRate),
        monthlyPayment: numOrNull(body.monthlyPayment),
        originalPrincipal: numOrNull(body.originalPrincipal),
        lenderName: strOrNull(body.lenderName),
        notes: strOrNull(body.notes),
        updatedAt: Date.now(),
      })
      .run();

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}
