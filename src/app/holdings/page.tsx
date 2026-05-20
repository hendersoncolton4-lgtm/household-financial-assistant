import Link from "next/link";
import { db, schema } from "@/lib/db";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HoldingsPage() {
  const holdings = db.select().from(schema.holdings).all();
  const securities = db.select().from(schema.securities).all();
  const securityMap = new Map(securities.map((s) => [s.id, s]));
  const accounts = db.select().from(schema.accounts).all();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const items = db.select().from(schema.plaidItems).all();
  const itemMap = new Map(items.map((i) => [i.id, i]));

  // Group by account
  const byAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const list = byAccount.get(h.accountId) ?? [];
    list.push(h);
    byAccount.set(h.accountId, list);
  }

  const totalValue = holdings.reduce(
    (s, h) => s + (h.institutionValue ?? 0),
    0
  );
  const totalCostBasis = holdings.reduce(
    (s, h) => s + (h.costBasis ?? 0),
    0
  );
  const totalUnrealizedGain =
    totalCostBasis > 0 ? totalValue - totalCostBasis : 0;

  // For the chat hint at the top
  const investmentAccounts = accounts.filter(
    (a) => a.type === "investment" && a.source === "plaid"
  );
  const accountsWithHoldings = new Set(byAccount.keys());
  const investmentAccountsWithoutHoldings = investmentAccounts.filter(
    (a) => !accountsWithHoldings.has(a.id)
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Holdings</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Your actual positions, pulled from connected brokerages via Plaid.
          Prices are as of Plaid's last reported close; not real-time. Click any
          ticker to research it.
        </p>
      </header>

      {holdings.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            No holdings yet. Plaid Investments needs to be enabled per
            institution. The fastest path:
          </p>
          <ol className="mx-auto mt-4 max-w-md list-decimal space-y-1 text-left text-sm text-slate-300">
            <li>Go to <Link href="/accounts" className="text-emerald-300 underline">Accounts</Link></li>
            <li>Click <strong>Disconnect</strong> on each Plaid institution</li>
            <li>Click <strong>+ Connect via Plaid</strong> and re-link each one</li>
            <li>This time Plaid will ask for permission to share <em>Investments</em> too — accept</li>
            <li>Hit <strong>Sync now</strong> on Accounts — positions will flow in here</li>
          </ol>
          <p className="mt-4 text-xs text-slate-500">
            Coverage varies by institution. Big brokerages (Vanguard, Fidelity,
            Schwab, E*Trade) usually work fully. Robinhood often works for
            positions but not always cost basis. Worst case, a few institutions
            won't share — the rest still will.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Total value" value={formatCurrency(totalValue)} accent />
            <Stat label="Total cost basis" value={formatCurrency(totalCostBasis)} />
            <Stat
              label="Unrealized gain/loss"
              value={
                totalCostBasis > 0
                  ? `${totalUnrealizedGain >= 0 ? "+" : ""}${formatCurrency(totalUnrealizedGain)}`
                  : "—"
              }
              positive={totalUnrealizedGain > 0}
              negative={totalUnrealizedGain < 0}
            />
          </section>

          {investmentAccountsWithoutHoldings.length > 0 && (
            <section className="rounded-md border border-amber-700/50 bg-amber-950/20 p-4 text-xs text-amber-200">
              <strong>{investmentAccountsWithoutHoldings.length} investment account(s)</strong> connected
              via Plaid but with no holdings here — those institutions probably haven't
              shared Investments data yet (either they don't support it or the
              link was made before Investments was requested). Disconnect +
              reconnect via the Accounts page to fix.
            </section>
          )}

          {Array.from(byAccount.entries()).map(([accountId, accountHoldings]) => {
            const acct = accountMap.get(accountId);
            const inst = acct ? itemMap.get(acct.itemId) : null;
            const accountTotal = accountHoldings.reduce(
              (s, h) => s + (h.institutionValue ?? 0),
              0
            );
            // Sort by value descending
            const sorted = [...accountHoldings].sort(
              (a, b) => (b.institutionValue ?? 0) - (a.institutionValue ?? 0)
            );
            return (
              <section
                key={accountId}
                className="rounded-lg border border-slate-800 bg-slate-900"
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      {inst?.institutionName ?? "Unknown"} — {acct?.name ?? accountId}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {sorted.length} position{sorted.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Total
                    </div>
                    <div className="text-sm font-semibold text-slate-100">
                      {formatCurrency(accountTotal)}
                    </div>
                  </div>
                </header>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-2">Symbol</th>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Value</th>
                      <th className="px-4 py-2 text-right">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {sorted.map((h) => {
                      const sec = securityMap.get(h.securityId);
                      const gain =
                        h.costBasis && h.institutionValue
                          ? h.institutionValue - h.costBasis
                          : null;
                      return (
                        <tr key={h.id}>
                          <td className="px-4 py-2 font-mono text-slate-100">
                            {sec?.ticker ? (
                              <Link
                                href={`/research/${sec.ticker}`}
                                className="font-semibold hover:underline"
                              >
                                {sec.ticker}
                              </Link>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-300">
                            {sec?.name ?? "Unknown security"}
                            {sec?.type && (
                              <span className="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                                {sec.type}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-300">
                            {h.quantity.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-300">
                            {h.institutionPrice != null
                              ? `$${h.institutionPrice.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-100">
                            {h.institutionValue != null
                              ? formatCurrency(h.institutionValue)
                              : "—"}
                          </td>
                          <td
                            className={`px-4 py-2 text-right text-sm font-medium ${
                              gain == null
                                ? "text-slate-500"
                                : gain >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {gain == null
                              ? "—"
                              : `${gain >= 0 ? "+" : ""}${formatCurrency(gain)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  positive,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-emerald-700 bg-emerald-950/40"
          : positive
          ? "border-emerald-700/60 bg-emerald-950/20"
          : negative
          ? "border-rose-700/60 bg-rose-950/20"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent
            ? "text-emerald-300"
            : positive
            ? "text-emerald-300"
            : negative
            ? "text-rose-300"
            : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
