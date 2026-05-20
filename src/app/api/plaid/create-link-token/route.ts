import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";

export const runtime = "nodejs";

/**
 * Creates a Plaid Link token. New connections request both Transactions and
 * Investments so we can pull positions. Investments is optional-but-requested
 * via `optional_products` — institutions without investments support won't
 * fail; they'll just skip that product.
 */
export async function POST() {
  try {
    const res = await plaid().linkTokenCreate({
      user: { client_user_id: "household-user" },
      client_name: "Household Financial Assistant",
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
