import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  const txns = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date))
    .limit(200)
    .all();

  const accountsList = db.select().from(schema.accounts).all();
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Transactions</h1>
        <p className="mt-1 text-sm text-slate-400">
          {txns.length === 0
            ? "No transactions yet. Connect an account to start syncing."
            : `Showing the latest ${txns.length} transactions across all accounts.`}
        </p>
      </section>

      {txns.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <Link
            href="/connect"
            className="inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Connect an account →
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Merchant</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {txns.map((t) => {
                const acct = accountMap.get(t.accountId);
                const cat = t.category ? (JSON.parse(t.category) as string[]) : [];
                return (
                  <tr key={t.id} className={t.pending ? "bg-slate-800/30" : ""}>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-100">
                        {t.merchantName ?? t.name}
                      </div>
                      {t.merchantName && t.merchantName !== t.name && (
                        <div className="text-xs text-slate-500">{t.name}</div>
                      )}
                      {t.pending && (
                        <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                          pending
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                      {acct?.name ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {cat.length > 0 ? cat[cat.length - 1] : "—"}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                        t.amount < 0 ? "text-emerald-400" : "text-slate-100"
                      }`}
                    >
                      {t.amount < 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(t.amount), t.isoCurrencyCode)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
