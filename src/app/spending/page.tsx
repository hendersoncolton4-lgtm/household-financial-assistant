import Link from "next/link";
import {
  cashFlow,
  detectIncomeSources,
  getTransactionsSince,
  spendingByCategory,
  spendingByMerchant,
} from "@/lib/transactions";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SpendingPage(props: PageProps<"/spending">) {
  const sp = await props.searchParams;
  const windowDays = clampWindow(sp.window);
  const txns = getTransactionsSince(windowDays);
  const cf = cashFlow(txns, windowDays);
  const income = detectIncomeSources(txns);
  const categories = spendingByCategory(txns);
  const merchants = spendingByMerchant(txns, 20);

  const totalIncome = income.reduce((s, x) => s + x.total, 0);
  const categoryTotal = categories.reduce((s, c) => s + c.total, 0);
  const merchantTotal = merchants.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Spending</h1>
          <p className="mt-1 text-sm text-slate-400">
            {txns.length === 0
              ? "No transactions in this window yet."
              : `${cf.count} transactions over the last ${windowDays} days.`}
          </p>
        </div>
        <PeriodSwitch current={windowDays} />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Money in" value={formatCurrency(cf.inflow)} positive />
        <Stat label="Money out" value={formatCurrency(cf.outflow)} negative />
        <Stat
          label="Net"
          value={formatCurrency(cf.net)}
          positive={cf.net >= 0}
          negative={cf.net < 0}
        />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Income sources</h2>
          <div className="text-xs text-slate-400">{formatCurrency(totalIncome)} total</div>
        </header>
        {income.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            No income ≥ $100 detected in this window. If you're expecting paychecks here, hit
            Sync on the Accounts page — Plaid may still be backfilling.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {income.map((s) => (
              <li key={s.source} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {s.source}
                    {s.isWages && (
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        Wages
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {s.count} deposit(s){s.categoryLabel ? ` · ${s.categoryLabel}` : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold text-emerald-400">
                  +{formatCurrency(s.total)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Spending by category</h2>
          <div className="text-xs text-slate-400">
            {formatCurrency(categoryTotal)} across {categories.length} categories
          </div>
        </header>
        {categories.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No spending in this window.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {categories.map((c) => {
              const pct = categoryTotal > 0 ? c.total / categoryTotal : 0;
              return (
                <li key={c.key} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-100">{c.label}</div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-xs text-slate-500">{c.count} txn</span>
                      <span className="text-sm font-semibold text-slate-100">
                        {formatCurrency(c.total)}
                      </span>
                      <span className="w-10 text-right text-xs text-slate-500">
                        {(pct * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full ${barClass(c.key)}`}
                      style={{ width: `${(pct * 100).toFixed(1)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Top merchants</h2>
          <div className="text-xs text-slate-400">
            Top {merchants.length} = {formatCurrency(merchantTotal)}
          </div>
        </header>
        {merchants.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">No merchant spending in this window.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {merchants.map((m) => (
              <li key={m.merchant} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-100">{m.merchant}</div>
                  <div className="text-xs text-slate-500">{m.count} txn</div>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {formatCurrency(m.total)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="text-xs text-slate-500">
        Categories come from Plaid's auto-classifier. If something looks miscategorized, let
        me know and we can add per-merchant override rules — or you can view raw transactions
        on the <Link href="/transactions" className="underline hover:text-slate-300">Transactions</Link> page.
      </section>
    </div>
  );
}

function clampWindow(raw: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(raw) ? raw[0] : raw ?? "30", 10);
  if ([30, 60, 90].includes(n)) return n;
  return 30;
}

function PeriodSwitch({ current }: { current: number }) {
  const options = [30, 60, 90];
  return (
    <div className="flex rounded-md border border-slate-700 bg-slate-900 p-0.5 text-xs font-medium">
      {options.map((n) => (
        <Link
          key={n}
          href={`/spending?window=${n}`}
          className={`rounded px-3 py-1.5 ${
            current === n
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          {n}d
        </Link>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        positive
          ? "border-emerald-700/60 bg-emerald-950/30"
          : negative
          ? "border-rose-700/60 bg-rose-950/30"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/** A stable color per Plaid primary category so the same category always
 * draws the same color across renders. Hash-based, no chart library needed. */
function barClass(key: string): string {
  const palette = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-fuchsia-500",
    "bg-orange-500",
    "bg-indigo-500",
    "bg-lime-500",
  ];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}
