import { desc, eq, and, like, gte } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { CongressSyncButton } from "./sync-button";
import { CongressFilterBar } from "./filter-bar";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function CongressPage(props: PageProps<"/congress">) {
  const sp = await props.searchParams;
  const legislator = stringParam(sp.legislator);
  const ticker = stringParam(sp.ticker)?.toUpperCase();
  const chamber = stringParam(sp.chamber);
  const side = stringParam(sp.side);
  const sinceParam = stringParam(sp.since);
  const sinceDate = sinceParam ?? defaultSince();

  const conditions = [gte(schema.congressTrades.dateTraded, sinceDate)];
  if (legislator)
    conditions.push(like(schema.congressTrades.legislatorSlug, `%${slug(legislator)}%`));
  if (ticker) conditions.push(eq(schema.congressTrades.ticker, ticker));
  if (chamber && chamber !== "all")
    conditions.push(eq(schema.congressTrades.chamber, chamber));
  if (side && side !== "all") conditions.push(eq(schema.congressTrades.side, side));

  const trades = db
    .select()
    .from(schema.congressTrades)
    .where(and(...conditions))
    .orderBy(desc(schema.congressTrades.dateTraded))
    .limit(LIMIT)
    .all();

  const totalCount = db.select().from(schema.congressTrades).all().length;
  const allLegislators = Array.from(
    new Set(
      db
        .select({
          name: schema.congressTrades.legislator,
          chamber: schema.congressTrades.chamber,
        })
        .from(schema.congressTrades)
        .all()
        .map((r) => `${r.name}|${r.chamber}`)
    )
  )
    .map((s) => {
      const [name, ch] = s.split("|");
      return { name, chamber: ch };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Per-legislator activity (count of trades since the cutoff date)
  const lastReportedDate = db
    .select({ date: schema.congressTrades.dateReported })
    .from(schema.congressTrades)
    .orderBy(desc(schema.congressTrades.dateReported))
    .limit(1)
    .get();

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            Congressional trades
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Periodic Transaction Reports (PTRs) filed by members of Congress
            under the STOCK Act. Disclosures are typically filed weeks after
            the trade — usually within 30–45 days. Data is aggregated by{" "}
            <a
              href="https://senatestockwatcher.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-300"
            >
              senatestockwatcher.com
            </a>{" "}
            and{" "}
            <a
              href="https://housestockwatcher.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-300"
            >
              housestockwatcher.com
            </a>{" "}
            from the official portals.
          </p>
        </div>
        <CongressSyncButton totalCount={totalCount} lastReported={lastReportedDate?.date ?? null} />
      </header>

      <CongressFilterBar
        legislator={legislator ?? ""}
        ticker={ticker ?? ""}
        chamber={chamber ?? "all"}
        side={side ?? "all"}
        since={sinceDate}
        allLegislators={allLegislators}
      />

      {totalCount === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          No data yet. Hit "Sync now" above — it pulls a few thousand recent
          trades from the open Senate + House datasets. Takes ~10–30s.
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-5 py-2 text-xs text-slate-400">
            Showing {trades.length}{trades.length >= LIMIT ? "+" : ""} of {totalCount} total trades (filter to narrow).
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Traded</th>
                <th className="px-4 py-2">Legislator</th>
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">Side</th>
                <th className="px-4 py-2">Amount range</th>
                <th className="px-4 py-2">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {trades.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/30">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                    {formatDate(t.dateTraded)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-100">{t.legislator}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                      {t.chamber}
                      {t.party && ` · ${t.party}`}
                      {t.state && ` · ${t.state}`}
                      {t.ownerType && t.ownerType !== "self" && ` · ${t.ownerType}`}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {t.ticker ? (
                      <Link
                        href={`/research/${t.ticker}`}
                        className="text-slate-100 hover:underline"
                      >
                        {t.ticker}
                      </Link>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                    {t.assetName && (
                      <div className="text-[10px] text-slate-500 line-clamp-1">
                        {t.assetName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        t.side === "purchase"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : t.side === "sale"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {t.side}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-300">
                    {t.amountRange ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                    {t.dateReported ? formatDate(t.dateReported) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="text-xs text-slate-500">
        <strong className="text-slate-300">Caveats:</strong> Amounts are
        reported as legal-required ranges (e.g. "$1,001 – $15,000"), not exact
        values. "Owner" can be self, spouse, dependent, or joint. PTRs are
        late by definition — useful as research input, not a real-time signal.
      </section>
    </div>
  );
}

function defaultSince(): string {
  // Default to "last 60 days" of trade dates
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return d.toISOString().slice(0, 10);
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
