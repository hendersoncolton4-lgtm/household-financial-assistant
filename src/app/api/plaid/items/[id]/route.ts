import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/plaid/items/[id]">
) {
  try {
    const { id } = await ctx.params;
    const item = db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.id, id))
      .get();
    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Best-effort: invalidate the access token on Plaid's side so the item
    // doesn't keep counting against the trial limit. Don't block local
    // cleanup if Plaid's side fails (e.g., already revoked).
    let plaidRemoved = true;
    let plaidError: string | null = null;
    try {
      const accessToken = decrypt(item.accessTokenEnc);
      await plaid().itemRemove({ access_token: accessToken });
    } catch (err) {
      plaidRemoved = false;
      plaidError = err instanceof Error ? err.message : String(err);
    }

    db.delete(schema.transactions)
      .where(eq(schema.transactions.itemId, id))
      .run();
    db.delete(schema.accounts).where(eq(schema.accounts.itemId, id)).run();
    db.delete(schema.plaidItems).where(eq(schema.plaidItems.id, id)).run();

    return NextResponse.json({ ok: true, plaidRemoved, plaidError });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
