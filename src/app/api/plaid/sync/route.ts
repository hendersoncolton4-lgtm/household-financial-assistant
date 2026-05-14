import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    const items = db.select().from(schema.plaidItems).all();
    if (items.length === 0) {
      return NextResponse.json({ added: 0, modified: 0, removed: 0, items: 0 });
    }

    let added = 0;
    let modified = 0;
    let removed = 0;

    for (const item of items) {
      const accessToken = decrypt(item.accessTokenEnc);
      let cursor: string | null = item.cursor;
      let hasMore = true;

      while (hasMore) {
        const res = await plaid().transactionsSync({
          access_token: accessToken,
          cursor: cursor ?? undefined,
        });

        for (const t of res.data.added) {
          db.insert(schema.transactions)
            .values({
              id: t.transaction_id,
              accountId: t.account_id,
              itemId: item.id,
              date: t.date,
              amount: t.amount,
              isoCurrencyCode: t.iso_currency_code ?? "USD",
              name: t.name,
              merchantName: t.merchant_name ?? null,
              category: t.category ? JSON.stringify(t.category) : null,
              pending: t.pending,
            })
            .onConflictDoNothing()
            .run();
          added++;
        }

        for (const t of res.data.modified) {
          db.update(schema.transactions)
            .set({
              accountId: t.account_id,
              date: t.date,
              amount: t.amount,
              isoCurrencyCode: t.iso_currency_code ?? "USD",
              name: t.name,
              merchantName: t.merchant_name ?? null,
              category: t.category ? JSON.stringify(t.category) : null,
              pending: t.pending,
            })
            .where(eq(schema.transactions.id, t.transaction_id))
            .run();
          modified++;
        }

        for (const t of res.data.removed) {
          if (t.transaction_id) {
            db.delete(schema.transactions)
              .where(eq(schema.transactions.id, t.transaction_id))
              .run();
            removed++;
          }
        }

        cursor = res.data.next_cursor;
        hasMore = res.data.has_more;
      }

      const accRes = await plaid().accountsGet({ access_token: accessToken });
      for (const a of accRes.data.accounts) {
        db.update(schema.accounts)
          .set({
            currentBalance: a.balances.current ?? null,
            availableBalance: a.balances.available ?? null,
            updatedAt: Date.now(),
          })
          .where(eq(schema.accounts.id, a.account_id))
          .run();
      }

      db.update(schema.plaidItems)
        .set({ cursor })
        .where(eq(schema.plaidItems.id, item.id))
        .run();
    }

    return NextResponse.json({ added, modified, removed, items: items.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
