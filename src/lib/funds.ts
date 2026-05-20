import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  fetchAndParseInfoTable,
  getFormTypeSummary,
  getRecentFilings,
  padCik,
  resolveTicker,
  type ParsedInfoTable,
} from "@/lib/sec";

export type SyncResult = {
  filingsSynced: number;
  newestReportDate: string | null;
  /** Set when we can't pull 13Fs and want to explain why. */
  warning?: string;
};

/**
 * Pull the most recent 13F filings for a fund and parse their info tables.
 * Skips filings we already have stored (by accession number) — re-syncing
 * an already-synced fund is cheap.
 */
export async function syncFundFilings(
  cik: string,
  maxFilings = 4
): Promise<SyncResult> {
  const padded = padCik(cik);
  const meta = await getRecentFilings(padded, "13F-HR", maxFilings);
  if (meta.length === 0) {
    // Inspect what forms this CIK *does* file so the user gets a useful
    // explanation instead of a silent zero.
    let warning =
      "No 13F-HR filings found for this CIK. Only institutional investment managers with >$100M AUM file 13F-HR.";
    try {
      const summary = await getFormTypeSummary(padded);
      if (summary.size > 0) {
        const top = Array.from(summary.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([f, c]) => `${f} (${c})`)
          .join(", ");
        warning += ` Forms this CIK has actually filed: ${top}. If this is an individual or company insider, those would be Form 4/3/5 (insider transactions), not portfolio holdings.`;
      }
    } catch {
      // best-effort
    }
    return { filingsSynced: 0, newestReportDate: null, warning };
  }

  let filingsSynced = 0;
  let newest: string | null = null;

  for (const m of meta) {
    const existing = db
      .select()
      .from(schema.fundFilings)
      .where(eq(schema.fundFilings.accessionNumber, m.accessionNumber))
      .get();
    if (existing) {
      if (!newest || existing.reportDate > newest) newest = existing.reportDate;
      continue;
    }

    let parsed: ParsedInfoTable[];
    try {
      parsed = await fetchAndParseInfoTable(padded, m.accessionNumber);
    } catch (err) {
      console.warn(`[sync] failed to parse ${m.accessionNumber}:`, err);
      continue;
    }
    if (parsed.length === 0) continue;

    // Aggregate by CUSIP — multi-manager funds (Berkshire and similar) file
    // separate rows per sub-manager for the same security. We want one
    // combined position per CUSIP so totals and percentages are correct.
    const aggregated = new Map<string, ParsedInfoTable>();
    for (const p of parsed) {
      const key = p.cusip ?? p.issuerName;
      const existing = aggregated.get(key);
      if (existing) {
        existing.shares += p.shares;
        existing.value += p.value;
      } else {
        aggregated.set(key, { ...p });
      }
    }
    const positions = Array.from(aggregated.values());

    const totalValue = positions.reduce((s, p) => s + p.value, 0);
    const filingId = randomUUID();
    const cikInt = String(parseInt(padded, 10));
    const accNoDashes = m.accessionNumber.replace(/-/g, "");

    db.insert(schema.fundFilings)
      .values({
        id: filingId,
        cik: padded,
        accessionNumber: m.accessionNumber,
        formType: m.formType,
        filingDate: m.filingDate,
        reportDate: m.reportDate,
        holdingsCount: positions.length,
        totalValue,
        filingUrl: `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDashes}/`,
        createdAt: Date.now(),
      })
      .run();

    // Resolve tickers in parallel — best effort, cached via tickerMap. Each
    // call is local-only after the first since the map is in-process.
    const resolved = await Promise.all(
      positions.map(async (p) => ({ ...p, ticker: await resolveTicker(p.issuerName).catch(() => null) }))
    );

    for (const h of resolved) {
      const id = `${filingId}:${h.cusip ?? h.issuerName}`;
      db.insert(schema.fundHoldings)
        .values({
          id,
          filingId,
          cik: padded,
          reportDate: m.reportDate,
          issuerName: h.issuerName,
          cusip: h.cusip,
          ticker: h.ticker,
          shares: h.shares,
          value: h.value,
          pctOfPortfolio: totalValue > 0 ? h.value / totalValue : 0,
        })
        .onConflictDoNothing()
        .run();
    }

    filingsSynced++;
    if (!newest || m.reportDate > newest) newest = m.reportDate;

    // Politeness: SEC rate-limits to ~10 req/sec. With multiple filings +
    // info-table fetches, sleep briefly between filings.
    await new Promise((r) => setTimeout(r, 150));
  }

  // Touch the fund's updatedAt so the UI shows it was just refreshed.
  db.update(schema.funds)
    .set({ updatedAt: Date.now() })
    .where(eq(schema.funds.cik, padded))
    .run();

  return { filingsSynced, newestReportDate: newest };
}

export type Diff = {
  added: Array<{ issuerName: string; ticker: string | null; value: number; pctOfPortfolio: number }>;
  exited: Array<{ issuerName: string; ticker: string | null; value: number; pctOfPortfolio: number }>;
  increased: Array<{
    issuerName: string;
    ticker: string | null;
    prevValue: number;
    currValue: number;
    deltaValue: number;
    deltaShares: number;
  }>;
  decreased: Array<{
    issuerName: string;
    ticker: string | null;
    prevValue: number;
    currValue: number;
    deltaValue: number;
    deltaShares: number;
  }>;
};

/**
 * Diff the two most recent filings for a fund — what's new, what's gone,
 * what's been added to or trimmed. CUSIP is the join key when available,
 * issuer name otherwise.
 */
export function diffLatestTwoFilings(cik: string): Diff | null {
  const padded = padCik(cik);
  const filings = db
    .select()
    .from(schema.fundFilings)
    .where(eq(schema.fundFilings.cik, padded))
    .orderBy(desc(schema.fundFilings.reportDate))
    .limit(2)
    .all();
  if (filings.length < 2) return null;
  const [curr, prev] = filings;
  const currHoldings = db
    .select()
    .from(schema.fundHoldings)
    .where(eq(schema.fundHoldings.filingId, curr.id))
    .all();
  const prevHoldings = db
    .select()
    .from(schema.fundHoldings)
    .where(eq(schema.fundHoldings.filingId, prev.id))
    .all();

  const keyOf = (h: { cusip: string | null; issuerName: string }) =>
    h.cusip ?? h.issuerName;
  const currMap = new Map(currHoldings.map((h) => [keyOf(h), h]));
  const prevMap = new Map(prevHoldings.map((h) => [keyOf(h), h]));

  const added: Diff["added"] = [];
  const exited: Diff["exited"] = [];
  const increased: Diff["increased"] = [];
  const decreased: Diff["decreased"] = [];

  for (const [k, c] of currMap.entries()) {
    if (!prevMap.has(k)) {
      added.push({
        issuerName: c.issuerName,
        ticker: c.ticker,
        value: c.value,
        pctOfPortfolio: c.pctOfPortfolio,
      });
    } else {
      const p = prevMap.get(k)!;
      const dV = c.value - p.value;
      const dS = c.shares - p.shares;
      // Use shares as the source of truth for "added to / trimmed" — value
      // can swing on price alone even without a position change.
      if (dS > 0 && dS / p.shares > 0.05) {
        increased.push({
          issuerName: c.issuerName,
          ticker: c.ticker,
          prevValue: p.value,
          currValue: c.value,
          deltaValue: dV,
          deltaShares: dS,
        });
      } else if (dS < 0 && Math.abs(dS) / p.shares > 0.05) {
        decreased.push({
          issuerName: c.issuerName,
          ticker: c.ticker,
          prevValue: p.value,
          currValue: c.value,
          deltaValue: dV,
          deltaShares: dS,
        });
      }
    }
  }
  for (const [k, p] of prevMap.entries()) {
    if (!currMap.has(k)) {
      exited.push({
        issuerName: p.issuerName,
        ticker: p.ticker,
        value: p.value,
        pctOfPortfolio: p.pctOfPortfolio,
      });
    }
  }

  // Sort each list by value descending so the biggest changes float up.
  added.sort((a, b) => b.value - a.value);
  exited.sort((a, b) => b.value - a.value);
  increased.sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));
  decreased.sort((a, b) => Math.abs(b.deltaValue) - Math.abs(a.deltaValue));

  return { added, exited, increased, decreased };
}

/**
 * "Which funds we follow hold this ticker, and at what weight?" Used to
 * cross-reference on /research/[symbol].
 */
export function findFundsHoldingTicker(ticker: string): Array<{
  cik: string;
  fundName: string;
  reportDate: string;
  value: number;
  pctOfPortfolio: number;
  shares: number;
}> {
  // Pull the most recent filing per fund, then check whether the ticker
  // appears in its holdings.
  const allFunds = db.select().from(schema.funds).all();
  const out: Array<{
    cik: string;
    fundName: string;
    reportDate: string;
    value: number;
    pctOfPortfolio: number;
    shares: number;
  }> = [];
  for (const f of allFunds) {
    const latest = db
      .select()
      .from(schema.fundFilings)
      .where(eq(schema.fundFilings.cik, f.cik))
      .orderBy(desc(schema.fundFilings.reportDate))
      .limit(1)
      .get();
    if (!latest) continue;
    const hit = db
      .select()
      .from(schema.fundHoldings)
      .where(
        and(
          eq(schema.fundHoldings.filingId, latest.id),
          eq(schema.fundHoldings.ticker, ticker.toUpperCase())
        )
      )
      .get();
    if (!hit) continue;
    out.push({
      cik: f.cik,
      fundName: f.name,
      reportDate: latest.reportDate,
      value: hit.value,
      pctOfPortfolio: hit.pctOfPortfolio,
      shares: hit.shares,
    });
  }
  out.sort((a, b) => b.pctOfPortfolio - a.pctOfPortfolio);
  return out;
}
