import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import type { Transaction as PlaidTransaction } from "plaid";
import { plaid } from "@/lib/plaid";
import { db, schema } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { findMatchingRule } from "@/lib/rules";

export const runtime = "nodejs";

/**
 * Pull investments holdings for one item and replace the cached rows for it.
 * "Replace" because Plaid returns the full set each call — no incremental
 * sync for holdings.
 */
async function syncInvestments(itemDbId: string, accessToken: string) {
  const res = await plaid().investmentsHoldingsGet({ access_token: accessToken });
  const now = Date.now();

  // Upsert securities (shared across items)
  for (const s of res.data.securities) {
    db.insert(schema.securities)
      .values({
        id: s.security_id,
        ticker: s.ticker_symbol ?? null,
        name: s.name ?? null,
        type: s.type ?? null,
        isin: s.isin ?? null,
        cusip: s.cusip ?? null,
        closePrice: s.close_price ?? null,
        closePriceAsOf: s.close_price_as_of ?? null,
        isoCurrencyCode: s.iso_currency_code ?? "USD",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.securities.id,
        set: {
          ticker: s.ticker_symbol ?? null,
          name: s.name ?? null,
          type: s.type ?? null,
          closePrice: s.close_price ?? null,
          closePriceAsOf: s.close_price_as_of ?? null,
          updatedAt: now,
        },
      })
      .run();
  }

  // Drop existing holdings for this item, then re-insert. Cleaner than
  // diff/upsert and Plaid returns the full set anyway.
  db.delete(schema.holdings).where(eq(schema.holdings.itemId, itemDbId)).run();
  for (const h of res.data.holdings) {
    const id = `${itemDbId}:${h.account_id}:${h.security_id}`;
    db.insert(schema.holdings)
      .values({
        id,
        itemId: itemDbId,
        accountId: h.account_id,
        securityId: h.security_id,
        quantity: h.quantity,
        institutionPrice: h.institution_price ?? null,
        institutionPriceAsOf: h.institution_price_as_of ?? null,
        institutionValue: h.institution_value ?? null,
        costBasis: h.cost_basis ?? null,
        isoCurrencyCode: h.iso_currency_code ?? "USD",
        updatedAt: now,
      })
      .run();
  }
}

/**
 * Prefer Personal Finance Category (PFC), fall back to legacy `category`.
 * Returns [primary, detailed?] so downstream parsers see the same shape.
 */
function extractCategory(t: PlaidTransaction): string[] | null {
  const pfc = t.personal_finance_category;
  if (pfc?.primary) {
    return pfc.detailed ? [pfc.primary, pfc.detailed] : [pfc.primary];
  }
  if (t.category && t.category.length > 0) {
    return t.category;
  }
  return null;
}

export async function POST() {
  try {
    const items = db.select().from(schema.plaidItems).all();
    if (items.length === 0) {
      return NextResponse.json({ added: 0, modified: 0, removed: 0, items: 0 });
    }

    // Load existing rules once per sync — saves a query per transaction.
    // We can't use a simple Map<merchant, category> anymore because rules
    // now have amount ranges and multiple rules may exist per merchant.
    const rules = db.select().from(schema.categoryRules).all();

    let added = 0;
    let modified = 0;
    let removed = 0;
    const itemErrors: Array<{
      itemId: string;
      institution: string | null;
      errorCode: string | null;
      message: string;
    }> = [];

    // Wrap each item in its own try/catch so one broken institution doesn't
    // abort the whole sync. Before this: an ITEM_LOGIN_REQUIRED on Arvest
    // meant Vanguard + U.S. Bank never got synced either.
    for (const item of items) {
      try {
      const accessToken = decrypt(item.accessTokenEnc);
      let cursor: string | null = item.cursor;
      let hasMore = true;

      while (hasMore) {
        const res = await plaid().transactionsSync({
          access_token: accessToken,
          cursor: cursor ?? undefined,
        });

        for (const t of res.data.added) {
          const categoryArr = extractCategory(t);
          const merchantKey = t.merchant_name ?? t.name;
          const matchingRule = findMatchingRule(rules, merchantKey, t.amount);
          // Rule overrides Plaid's classification, else use Plaid's primary.
          const categoryKey =
            matchingRule?.categoryKey ??
            (categoryArr ? categoryArr[0] : null);

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
              category: categoryArr ? JSON.stringify(categoryArr) : null,
              categoryKey,
              pending: t.pending,
            })
            .onConflictDoUpdate({
              target: schema.transactions.id,
              set: {
                accountId: t.account_id,
                date: t.date,
                amount: t.amount,
                isoCurrencyCode: t.iso_currency_code ?? "USD",
                name: t.name,
                merchantName: t.merchant_name ?? null,
                category: categoryArr ? JSON.stringify(categoryArr) : null,
                // Note: we do NOT overwrite categoryKey here. Once a row has
                // a key set (by user override or earlier sync), it sticks.
                pending: t.pending,
              },
            })
            .run();
          added++;
        }

        for (const t of res.data.modified) {
          const categoryArr = extractCategory(t);
          // Same logic as above: update the Plaid-reported fields but leave
          // categoryKey alone — the user may have re-categorized.
          db.update(schema.transactions)
            .set({
              accountId: t.account_id,
              date: t.date,
              amount: t.amount,
              isoCurrencyCode: t.iso_currency_code ?? "USD",
              name: t.name,
              merchantName: t.merchant_name ?? null,
              category: categoryArr ? JSON.stringify(categoryArr) : null,
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
            creditLimit: a.balances.limit ?? null,
            updatedAt: Date.now(),
          })
          .where(eq(schema.accounts.id, a.account_id))
          .run();
      }

      // Investments holdings — best-effort. Items linked before we requested
      // the Investments product will error; we swallow and continue.
      await syncInvestments(item.id, accessToken).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/PRODUCT_NOT_READY|INVALID_PRODUCT|MISSING_PRODUCT/i.test(msg)) {
          console.warn(`[sync] investments error for ${item.id}:`, msg);
        }
      });

      db.update(schema.plaidItems)
        .set({ cursor })
        .where(eq(schema.plaidItems.id, item.id))
        .run();
      } catch (err) {
        const anyErr = err as {
          response?: { data?: { error_code?: string; error_message?: string } };
          message?: string;
        };
        const errorCode = anyErr.response?.data?.error_code ?? null;
        const message =
          anyErr.response?.data?.error_message ??
          anyErr.message ??
          "Unknown Plaid error";
        console.error(
          `[plaid/sync] item ${item.institutionName ?? item.id} failed (${errorCode ?? "unknown"}): ${message}`
        );
        itemErrors.push({
          itemId: item.id,
          institution: item.institutionName,
          errorCode,
          message,
        });
        // Continue to the next item.
      }
    }

    return NextResponse.json({
      added,
      modified,
      removed,
      items: items.length,
      itemErrors,
    });
  } catch (err) {
    // Log the real Plaid error body so it shows up in `fly logs`. The bare
    // `err.message` is often just "Request failed with status code 400" —
    // the useful bit lives in err.response.data.
    const anyErr = err as {
      response?: { data?: unknown };
      message?: string;
    };
    console.error("[plaid/sync] failed:", anyErr.message);
    if (anyErr.response?.data) {
      console.error("[plaid/sync] plaid error body:", JSON.stringify(anyErr.response.data));
    }
    const message = anyErr.message ?? "Unknown error";
    return NextResponse.json(
      { error: message, plaidError: anyErr.response?.data ?? null },
      { status: 500 }
    );
  }
}
