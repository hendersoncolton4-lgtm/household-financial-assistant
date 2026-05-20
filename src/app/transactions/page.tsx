import Link from "next/link";
import { asc, desc, eq, isNull, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCategoryMap, labelForKey, merchantKey } from "@/lib/categories";
import { TransactionsView } from "./transactions-view";

export const dynamic = "force-dynamic";

const LIMIT = 500;

export default async function TransactionsPage(props: PageProps<"/transactions">) {
  const sp = await props.searchParams;
  const filter = typeof sp.category === "string" ? sp.category : null;

  const baseQuery = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date));

  // Build the filtered list. "uncategorized" is a special filter for null
  // category keys (transactions that haven't been classified).
  let txns;
  if (filter === "uncategorized") {
    txns = db
      .select()
      .from(schema.transactions)
      .where(isNull(schema.transactions.categoryKey))
      .orderBy(desc(schema.transactions.date))
      .limit(LIMIT)
      .all();
  } else if (filter && filter !== "all") {
    txns = db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.categoryKey, filter))
      .orderBy(desc(schema.transactions.date))
      .limit(LIMIT)
      .all();
  } else {
    txns = baseQuery.limit(LIMIT).all();
  }

  // Total counts (for the "filtered N of M" hint)
  const totalCountRow = db
    .select()
    .from(schema.transactions)
    .all();
  const totalCount = totalCountRow.length;

  const accountsList = db.select().from(schema.accounts).all();
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));

  const catMap = getCategoryMap();
  const categoryOptions = Array.from(catMap.values())
    .filter((c) => !c.archived)
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((c) => ({ key: c.key, label: c.label }));

  // For the filter bar: also include counts per category so the user can
  // see "Transportation (148)" etc.
  const categoryCounts = new Map<string, number>();
  let uncategorizedCount = 0;
  for (const t of totalCountRow) {
    if (!t.categoryKey) {
      uncategorizedCount++;
    } else {
      categoryCounts.set(t.categoryKey, (categoryCounts.get(t.categoryKey) ?? 0) + 1);
    }
  }
  const filterOptions = categoryOptions
    .map((o) => ({ ...o, count: categoryCounts.get(o.key) ?? 0 }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);

  // Per-merchant transaction counts (used by the edit dialog for the
  // "apply to all N from merchant X" copy).
  const merchantCounts = new Map<string, number>();
  for (const t of totalCountRow) {
    const k = merchantKey(t);
    merchantCounts.set(k, (merchantCounts.get(k) ?? 0) + 1);
  }

  // Flatten rows for the client component (Drizzle objects serialize fine,
  // but we attach derived display fields here while we have catMap handy).
  const rows = txns.map((t) => ({
    id: t.id,
    date: t.date,
    name: t.name,
    merchantName: t.merchantName,
    accountId: t.accountId,
    accountName: accountMap.get(t.accountId)?.name ?? "—",
    amount: t.amount,
    isoCurrencyCode: t.isoCurrencyCode,
    pending: t.pending,
    categoryKey: t.categoryKey,
    categoryLabel: labelForKey(t.categoryKey, catMap),
    merchantKey: merchantKey(t),
    merchantTxnCount: merchantCounts.get(merchantKey(t)) ?? 1,
  }));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {totalCount === 0
              ? "No transactions yet. Connect an account to start syncing."
              : filter
              ? `Showing ${rows.length}${rows.length >= LIMIT ? "+ (limit)" : ""} of ${totalCount} total`
              : `Showing latest ${rows.length} of ${totalCount} total`}
          </p>
        </div>
      </section>

      {totalCount === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <Link
            href="/connect"
            className="inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Connect an account →
          </Link>
        </section>
      ) : (
        <TransactionsView
          rows={rows}
          filterOptions={filterOptions}
          uncategorizedCount={uncategorizedCount}
          currentFilter={filter}
          categoryOptions={categoryOptions}
        />
      )}
    </div>
  );
}
