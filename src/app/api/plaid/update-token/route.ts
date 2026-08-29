import { CountryCode } from "plaid";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

/**
 * Create a Plaid Link token in "update mode" for an existing broken item.
 * Update mode reuses the item's existing access_token — no new exchange
 * happens; after the user completes the re-auth flow, the same token
 * becomes valid again. Used to fix ITEM_LOGIN_REQUIRED / PENDING_EXPIRATION.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemId = String(body.itemId ?? "");
    if (!itemId) {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }

    const item = db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.id, itemId))
      .get();
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const accessToken = decrypt(item.accessTokenEnc);

    // In update mode, we pass access_token and omit `products`. Plaid infers
    // the products from the existing item.
    const res = await plaid().linkTokenCreate({
      user: { client_user_id: "household-user" },
      client_name: "Household Financial Assistant",
      country_codes: [CountryCode.Us],
      language: "en",
      access_token: accessToken,
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    const anyErr = err as {
      response?: { data?: unknown };
      message?: string;
    };
    const message = anyErr.message ?? "Unknown error";
    return NextResponse.json(
      { error: message, plaidError: anyErr.response?.data ?? null },
      { status: 500 }
    );
  }
}
