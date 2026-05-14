import { CountryCode } from "plaid";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { public_token?: string };
    if (!body.public_token) {
      return NextResponse.json({ error: "public_token is required" }, { status: 400 });
    }

    const exch = await plaid().itemPublicTokenExchange({
      public_token: body.public_token,
    });
    const accessToken = exch.data.access_token;
    const plaidItemId = exch.data.item_id;

    let institutionId: string | null = null;
    let institutionName: string | null = null;
    try {
      const itemInfo = await plaid().itemGet({ access_token: accessToken });
      institutionId = itemInfo.data.item.institution_id ?? null;
      if (institutionId) {
        const inst = await plaid().institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = inst.data.institution.name;
      }
    } catch {
      // institution info is best-effort
    }

    const id = randomUUID();
    db.insert(schema.plaidItems)
      .values({
        id,
        itemId: plaidItemId,
        accessTokenEnc: encrypt(accessToken),
        institutionId,
        institutionName,
        cursor: null,
        createdAt: Date.now(),
      })
      .run();

    const accountsRes = await plaid().accountsGet({ access_token: accessToken });
    for (const a of accountsRes.data.accounts) {
      db.insert(schema.accounts)
        .values({
          id: a.account_id,
          itemId: id,
          name: a.name,
          officialName: a.official_name ?? null,
          type: a.type,
          subtype: a.subtype ?? null,
          mask: a.mask ?? null,
          currentBalance: a.balances.current ?? null,
          availableBalance: a.balances.available ?? null,
          isoCurrencyCode: a.balances.iso_currency_code ?? "USD",
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: schema.accounts.id,
          set: {
            currentBalance: a.balances.current ?? null,
            availableBalance: a.balances.available ?? null,
            updatedAt: Date.now(),
          },
        })
        .run();
    }

    return NextResponse.json({
      ok: true,
      itemId: id,
      institutionName,
      accounts: accountsRes.data.accounts.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
