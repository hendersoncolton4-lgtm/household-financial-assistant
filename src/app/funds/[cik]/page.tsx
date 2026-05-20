import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { padCik } from "@/lib/sec";
import { diffLatestTwoFilings } from "@/lib/funds";
import { formatCurrency } from "@/lib/format";
import { SyncFundButton } from "./sync-button";
import { MimicFundButton } from "./mimic-button";
import { DisconnectFundButton } from "./disconnect-button";

export const dynamic = "force-dynamic";

export default async function FundDetailPage(props: PageProps<"/funds/[cik]">) {
  const { cik: raw } = await props.params;
  const cik = padCik(raw);

  const fund = db
    .select()
    .from(schema.funds)
    .where(eq(schema.funds.cik, cik))
    .get();
  if (!fund) notFound();

  const filings = db
    .select()
    .from(schema.fundFilings)
    .where(eq(schema.fundFilings.cik, cik))
    .orderBy(desc(schema.fundFilings.reportDate))
    .all();
  const latestFiling = filings[0];

  const latestHoldings = latestFiling
    ? db
        .select()
        .from(schema.fundHoldings)
        .where(eq(schema.fundHoldings.filingId, latestFiling.id))
        .all()
        .sort((a, b) => b.value - a.value)
    : [];

  const diff = diffLatestTwoFilings(cik);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <Link href="/funds" className="hover:text-slate-300">
              ← Funds
            </Link>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
            {fund.name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            CIK {fund.cik}
            {latestFiling && (
              <>
                {" · "}Latest 13F filed {latestFiling.filingDate}, reporting{" "}
                {latestFiling.reportDate}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <SyncFundButton cik={cik} />
            <DisconnectFundButton cik={cik} name={fund.name} />
          </div>
          {latestFiling && <MimicFundButton cik={cik} fundName={fund.name} />}
        </div>
      </header>

      {!latestFiling ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          No 13F filings synced yet. Hit "Sync" above — we'll pull the most
          recent 4 filings (~1 year of quarterly snapshots).
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Total reported value"
              value={formatCurrency(latestFiling.totalValue)}
              accent
            />
            <Stat label="# of positions" value={String(latestFiling.holdingsCount)} />
            <Stat
              label="Top 10 concentration"
              value={(() => {
                const top10 = latestHoldings.slice(0, 10);
                const sum = top10.reduce((s, h) => s + h.value, 0);
                return latestFiling.totalValue > 0
                  ? `${((sum / latestFiling.totalValue) * 100).toFixed(0)}%`
                  : "—";
              })()}
            />
          </section>

          {diff && (
            <section className="grid gap-3 lg:grid-cols-2">
              <ChangeList
                title={`New positions (${diff.added.length})`}
                tone="emerald"
                items={diff.added.slice(0, 8).map((d) => ({
                  title: tickerOrName(d.ticker, d.issuerName),
                  detail: `${formatCurrency(d.value)} · ${(d.pctOfPortfolio * 100).toFixed(1)}% of portfolio`,
                }))}
              />
              <ChangeList
                title={`Exited (${diff.exited.length})`}
                tone="rose"
                items={diff.exited.slice(0, 8).map((d) => ({
                  title: tickerOrName(d.ticker, d.issuerName),
                  detail: `was ${formatCurrency(d.value)} · ${(d.pctOfPortfolio * 100).toFixed(1)}%`,
                }))}
              />
              <ChangeList
                title={`Added to (${diff.increased.length})`}
                tone="sky"
                items={diff.increased.slice(0, 8).map((d) => ({
                  title: tickerOrName(d.ticker, d.issuerName),
                  detail: `+${Math.round(d.deltaShares).toLocaleString()} sh · ${d.prevValue > 0 ? `${(((d.currValue - d.prevValue) / d.prevValue) * 100).toFixed(0)}% bigger` : ""}`,
                }))}
              />
              <ChangeList
                title={`Trimmed (${diff.decreased.length})`}
                tone="amber"
                items={diff.decreased.slice(0, 8).map((d) => ({
                  title: tickerOrName(d.ticker, d.issuerName),
                  detail: `${Math.round(d.deltaShares).toLocaleString()} sh · ${d.prevValue > 0 ? `${(((d.currValue - d.prevValue) / d.prevValue) * 100).toFixed(0)}%` : ""}`,
                }))}
              />
            </section>
          )}

          <section className="rounded-lg border border-slate-800 bg-slate-900">
            <header className="border-b border-slate-800 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Holdings as of {latestFiling.reportDate} ({latestHoldings.length})
              </h2>
            </header>
            <table className="w-full text-sm">
              <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2">Ticker</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Shares</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right">% of port</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {latestHoldings.slice(0, 50).map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2 font-mono text-slate-100">
                      {h.ticker ? (
                        <Link
                          href={`/research/${h.ticker}`}
                          className="font-semibold hover:underline"
                        >
                          {h.ticker}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-300">{h.issuerName}</td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {h.shares.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-100">
                      {formatCurrency(h.value)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {(h.pctOfPortfolio * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {latestHoldings.length > 50 && (
              <div className="px-5 py-3 text-xs text-slate-500">
                …and {latestHoldings.length - 50} smaller positions.
              </div>
            )}
          </section>

          <section className="text-xs text-slate-500">
            <strong className="text-slate-300">Reminder:</strong> 13F filings only
            show long US equity positions, are filed 45 days after quarter-end,
            and don't capture options, shorts, or mid-quarter trades. Treat any
            "mimic" proposals as research input, not a strategy you'd follow
            blindly with real money.
          </section>
        </>
      )}
    </div>
  );
}

function tickerOrName(ticker: string | null, issuerName: string) {
  return ticker ? `${ticker} (${issuerName})` : issuerName;
}

function ChangeList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "emerald" | "rose" | "sky" | "amber";
  items: Array<{ title: string; detail: string }>;
}) {
  const palette = {
    emerald: "border-emerald-700/60 bg-emerald-950/20 text-emerald-300",
    rose: "border-rose-700/60 bg-rose-950/20 text-rose-300",
    sky: "border-sky-700/60 bg-sky-950/20 text-sky-300",
    amber: "border-amber-700/60 bg-amber-950/20 text-amber-300",
  }[tone];
  return (
    <div className={`rounded-lg border ${palette.split(" ").slice(0, 2).join(" ")}`}>
      <div
        className={`border-b border-slate-800 px-4 py-2 text-sm font-semibold ${palette.split(" ")[2]}`}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-xs text-slate-500">None.</div>
      ) : (
        <ul className="divide-y divide-slate-800 text-sm">
          {items.map((it, i) => (
            <li key={i} className="px-4 py-2">
              <div className="font-medium text-slate-100">{it.title}</div>
              <div className="text-xs text-slate-400">{it.detail}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-emerald-700 bg-emerald-950/40" : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent ? "text-emerald-300" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
