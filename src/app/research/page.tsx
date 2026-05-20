import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSnapshots, type SnapshotData } from "@/lib/alpaca";
import { AddTickerForm } from "./add-form";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const watchlist = db
    .select()
    .from(schema.watchlist)
    .orderBy(asc(schema.watchlist.symbol))
    .all();

  let snapshots: Record<string, SnapshotData> = {};
  let snapshotError: string | null = null;
  if (watchlist.length > 0) {
    try {
      snapshots = await getSnapshots(watchlist.map((w) => w.symbol));
    } catch (err) {
      snapshotError = err instanceof Error ? err.message : "Failed to fetch prices";
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Research</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Watchlist + AI-generated investment theses. Prices and news come from
          Alpaca (free IEX-grade tier). No trading happens here — that's Phase 6.
          Nothing here is investment advice.
        </p>
      </header>

      {snapshotError && (
        <section className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          Couldn't fetch live prices: <code className="text-amber-100">{snapshotError}</code>
          <div className="mt-2 text-xs text-amber-300/80">
            Make sure ALPACA_API_KEY and ALPACA_SECRET are set in .env.local. Sign
            up free at <a href="https://alpaca.markets" className="underline">alpaca.markets</a> if
            you haven't yet.
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Watchlist</h2>
          <span className="text-xs text-slate-500">
            {watchlist.length} symbol{watchlist.length === 1 ? "" : "s"}
          </span>
        </header>
        {watchlist.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Nothing here yet. Add a ticker below to start tracking it.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Symbol</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-right">Change</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {watchlist.map((w) => {
                const s = snapshots[w.symbol];
                const positive = (s?.changePercent ?? 0) >= 0;
                return (
                  <tr key={w.symbol} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/research/${w.symbol}`}
                        className="font-semibold text-slate-100 hover:underline"
                      >
                        {w.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {w.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-100">
                      {s?.latestTradePrice != null
                        ? `$${s.latestTradePrice.toFixed(2)}`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-medium ${
                        s?.changeAmount == null
                          ? "text-slate-500"
                          : positive
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {s?.changeAmount != null && s.changePercent != null
                        ? `${positive ? "+" : ""}${s.changeAmount.toFixed(2)} (${(s.changePercent * 100).toFixed(2)}%)`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/research/${w.symbol}`}
                        className="text-xs font-medium text-slate-400 hover:text-slate-100"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <AddTickerForm />
      </section>

      <section className="rounded-md border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500">
        <strong className="text-slate-300">Heads up:</strong> Alpaca's free
        IEX-tier prices may lag full-market (SIP) prices by a small fraction
        and skip pre/after-market. Plenty accurate for research, not for fills.
      </section>
    </div>
  );
}
