import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";
import { plaid } from "@/lib/plaid";

export const runtime = "nodejs";

export async function POST() {
  try {
    const res = await plaid().linkTokenCreate({
      user: { client_user_id: "household-user" },
      client_name: "Household Financial Assistant",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
