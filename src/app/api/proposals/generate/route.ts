import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { generateProposal } from "@/lib/proposals";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = typeof body.symbol === "string" ? body.symbol : undefined;
    const request = typeof body.request === "string" ? body.request : undefined;

    const proposal = await generateProposal({ symbol, request });

    const id = randomUUID();
    const now = Date.now();
    db.insert(schema.proposals)
      .values({
        id,
        symbol: proposal.symbol,
        side: proposal.side,
        orderType: proposal.orderType,
        quantity: proposal.quantity,
        limitPrice: proposal.limitPrice,
        timeInForce: "day",
        estimatedValue: proposal.estimatedValue,
        rationale: proposal.rationale,
        riskNotes: proposal.riskNotes,
        generatedBy: "ai",
        status: "pending",
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
