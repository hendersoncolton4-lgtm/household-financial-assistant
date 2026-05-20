import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import {
  getNews,
  getRecentBars,
  getSnapshots,
  lookupAsset,
  type NewsArticle,
  type DailyBar,
  type SnapshotData,
  type AssetInfo,
} from "@/lib/alpaca";
import { GenerateThesisButton } from "./generate-thesis-button";
import { RemoveTickerButton } from "./remove-button";
import { AddTickerButton } from "./add-button";
import { ProposeTradeButton } from "./propose-button";

export const dynamic = "force-dynamic";

export default async function SymbolPage(props: PageProps<"/research/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = raw.toUpperCase();

  // The page works for ANY tradable symbol — not just ones already on the
  // watchlist. This lets users click through from /holdings without first
  // adding to the watchlist. If the symbol isn't recognized by Alpaca at all,
  // we 404.
  const entry = db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.symbol, symbol))
    .get();

  let snap: SnapshotData | undefined;
  let bars: DailyBar[] = [];
  let news: NewsArticle[] = [];
  let asset: AssetInfo | null = null;
  let error: string | null = null;
  try {
    [asset, ] = await Promise.all([
      lookupAsset(symbol),
      Promise.resolve(),
    ]);
    if (!asset && !entry) {
      // Unknown symbol AND not in our watchlist → genuinely doesn't exist
      notFound();
    }
    const [snaps, b, n] = await Promise.all([
      getSnapshots([symbol]),
      getRecentBars(symbol, 10).catch(() => []),
      getNews([symbol], 15).catch(() => []),
    ]);
    snap = snaps[symbol];
    bars = b;
    news = n;
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load market data";
  }

  const symbolTheses = db
    .select()
    .from(schema.theses)
    .where(eq(schema.theses.symbol, symbol))
    .orderBy(desc(schema.theses.createdAt))
    .all();

  const onWatchlist = !!entry;
  const positive = (snap?.changePercent ?? 0) >= 0;
  const displayName = entry?.name ?? asset?.name ?? null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <Link href="/research" className="hover:text-slate-300">
              ← Research
            </Link>
            <Link href="/holdings" className="hover:text-slate-300">
              Holdings
            </Link>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
            {symbol}
          </h1>
          <p className="mt-1 text-sm text-slate-400">{displayName ?? ""}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {onWatchlist ? (
            <RemoveTickerButton symbol={symbol} />
          ) : (
            <AddTickerButton symbol={symbol} />
          )}
          <ProposeTradeButton symbol={symbol} />
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          {error}
        </div>
      )}

      {snap && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Latest trade
              </div>
              <div className="text-4xl font-bold tracking-tight text-slate-100">
                {snap.latestTradePrice != null
                  ? `$${snap.latestTradePrice.toFixed(2)}`
                  : "—"}
              </div>
              <div
                className={`mt-1 text-sm font-medium ${
                  snap.changeAmount == null
                    ? "text-slate-500"
                    : positive
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {snap.changeAmount != null && snap.changePercent != null
                  ? `${positive ? "+" : ""}${snap.changeAmount.toFixed(2)} (${(snap.changePercent * 100).toFixed(2)}%) vs prev close`
                  : "—"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs text-slate-400">
              <div>Open</div>
              <div className="text-slate-200">
                {snap.dailyOpen != null ? `$${snap.dailyOpen.toFixed(2)}` : "—"}
              </div>
              <div>High</div>
              <div className="text-slate-200">
                {snap.dailyHigh != null ? `$${snap.dailyHigh.toFixed(2)}` : "—"}
              </div>
              <div>Low</div>
              <div className="text-slate-200">
                {snap.dailyLow != null ? `$${snap.dailyLow.toFixed(2)}` : "—"}
              </div>
              <div>Prev close</div>
              <div className="text-slate-200">
                {snap.prevDailyClose != null
                  ? `$${snap.prevDailyClose.toFixed(2)}`
                  : "—"}
              </div>
              <div>Volume</div>
              <div className="text-slate-200">
                {snap.dailyVolume != null
                  ? snap.dailyVolume.toLocaleString()
                  : "—"}
              </div>
            </div>
          </div>
        </section>
      )}

      {bars.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900">
          <header className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Last {bars.length} trading days
            </h2>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Open</th>
                <th className="px-4 py-2 text-right">High</th>
                <th className="px-4 py-2 text-right">Low</th>
                <th className="px-4 py-2 text-right">Close</th>
                <th className="px-4 py-2 text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {bars.map((b) => (
                <tr key={b.date}>
                  <td className="px-4 py-2 text-slate-400">
                    {b.date.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">
                    ${b.open.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">
                    ${b.high.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">
                    ${b.low.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-100">
                    ${b.close.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {b.volume.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {news.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900">
          <header className="border-b border-slate-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-100">Recent news</h2>
          </header>
          <ul className="divide-y divide-slate-800">
            {news.slice(0, 10).map((n) => (
              <li key={n.id} className="px-5 py-3">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-100 hover:underline"
                >
                  {n.headline}
                </a>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">
                  {n.source} · {n.createdAt.slice(0, 10)}
                </div>
                {n.summary && (
                  <p className="mt-1 text-sm text-slate-400">{n.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            AI investment theses ({symbolTheses.length})
          </h2>
          <GenerateThesisButton symbol={symbol} />
        </header>
        {symbolTheses.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            No theses yet. Hit "Generate" to have the assistant write one using
            the latest price action and news above.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {symbolTheses.map((t) => (
              <li key={t.id} className="px-5 py-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Generated {new Date(t.createdAt).toLocaleString()}
                  {t.priceSnapshot != null &&
                    ` · price at the time: $${t.priceSnapshot.toFixed(2)}`}
                  {t.newsHeadlineCount != null &&
                    ` · ${t.newsHeadlineCount} headline${t.newsHeadlineCount === 1 ? "" : "s"} in context`}
                </div>
                <article className="prose prose-invert mt-2 max-w-none text-sm text-slate-300">
                  <pre className="whitespace-pre-wrap rounded-md bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-200">
                    {t.content}
                  </pre>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
