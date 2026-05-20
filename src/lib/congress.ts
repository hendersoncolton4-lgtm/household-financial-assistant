import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCongressionalTrading, type FinnhubCongressTrade } from "@/lib/finnhub";

/**
 * Open community dataset of Senate transactions, archived on GitHub. The
 * original senatestockwatcher.com / housestockwatcher.com domains went
 * offline, so we use the GitHub-hosted archive. Senate data is historical
 * (through ~March 2021); for current data the user needs a paid feed
 * (Finnhub free tier, Quiver Quantitative, etc.).
 */
const SENATE_URL =
  "https://raw.githubusercontent.com/timothycarambat/senate-stock-watcher-data/master/aggregate/all_transactions.json";
// No working free House source as of writing. Slot reserved for when we
// wire up Finnhub / Quiver / or a direct PDF-based scrape of the House
// Clerk disclosures.
const HOUSE_URL: string | null = null;

type RawTrade = Record<string, unknown>;

export type CongressSyncResult = {
  fetched: number;
  inserted: number;
  skipped: number;
  /** Symbols we asked Finnhub about, for transparency in the UI. */
  finnhubSymbols: number;
  finnhubTrades: number;
  errors: string[];
};

export async function syncCongressTrades(): Promise<CongressSyncResult> {
  const errors: string[] = [];
  let fetched = 0;

  const [senate, house] = await Promise.all([
    fetchRaw(SENATE_URL).catch((e) => {
      errors.push(`Senate fetch failed: ${e?.message ?? e}`);
      return [] as RawTrade[];
    }),
    HOUSE_URL
      ? fetchRaw(HOUSE_URL).catch((e) => {
          errors.push(`House fetch failed: ${e?.message ?? e}`);
          return [] as RawTrade[];
        })
      : Promise.resolve([] as RawTrade[]),
  ]);
  fetched = senate.length + house.length;

  let inserted = 0;
  let skipped = 0;
  const now = Date.now();

  const stmt = (rec: NormalizedTrade) =>
    db
      .insert(schema.congressTrades)
      .values({ ...rec, createdAt: now })
      .onConflictDoNothing();

  for (const raw of senate) {
    const norm = normalizeTrade(raw, "senate", SENATE_URL);
    if (!norm) {
      skipped++;
      continue;
    }
    const before = countTrades();
    stmt(norm).run();
    const after = countTrades();
    if (after > before) inserted++;
    else skipped++;
  }
  for (const raw of house) {
    const norm = normalizeTrade(raw, "house", HOUSE_URL ?? "house");
    if (!norm) {
      skipped++;
      continue;
    }
    const before = countTrades();
    stmt(norm).run();
    const after = countTrades();
    if (after > before) inserted++;
    else skipped++;
  }

  // Phase 5c (current data): pull current congressional trades from Finnhub
  // for every symbol the household cares about — watchlist + investment
  // holdings (via Plaid). Finnhub's endpoint is per-symbol, so this naturally
  // scopes to what's relevant to the user.
  let finnhubSymbols = 0;
  let finnhubTrades = 0;
  if (process.env.FINNHUB_API_KEY) {
    const symbols = collectInterestSymbols();
    finnhubSymbols = symbols.length;
    for (const symbol of symbols) {
      try {
        const trades = await getCongressionalTrading(symbol);
        for (const t of trades) {
          const norm = normalizeFinnhubTrade(t);
          if (!norm) continue;
          const before = countTrades();
          db.insert(schema.congressTrades)
            .values({ ...norm, createdAt: now })
            .onConflictDoNothing()
            .run();
          const after = countTrades();
          if (after > before) {
            inserted++;
            finnhubTrades++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Bail early on auth/permission errors — Finnhub free tier doesn't
        // include congressional-trading; pounding 15 endpoints just makes
        // 15 identical errors. Same for rate-limit.
        if (
          msg.includes("don't have access") ||
          msg.includes("403") ||
          msg.includes("401") ||
          msg.includes("rate-limited")
        ) {
          errors.push(
            `Finnhub: ${msg.replace(/^Finnhub:?\s*/, "")}. Free tier doesn't include congressional-trading — needs a paid plan (~$50/mo). Skipped remaining ${symbols.length - finnhubSymbols + 1} symbols.`
          );
          break;
        }
        errors.push(`Finnhub error for ${symbol}: ${msg}`);
      }
    }
  } else {
    errors.push(
      "FINNHUB_API_KEY not set — Senate-only historical data. Add a key to .env.local for current Senate + House trades on your watchlist/holdings symbols."
    );
  }

  return {
    fetched: fetched + finnhubTrades,
    inserted,
    skipped,
    finnhubSymbols,
    finnhubTrades,
    errors,
  };
}

/** Symbols the user cares about — used to scope per-symbol Finnhub calls. */
function collectInterestSymbols(): string[] {
  const symbols = new Set<string>();
  for (const w of db.select().from(schema.watchlist).all()) {
    symbols.add(w.symbol.toUpperCase());
  }
  for (const s of db
    .select({ ticker: schema.securities.ticker })
    .from(schema.securities)
    .all()) {
    if (s.ticker) symbols.add(s.ticker.toUpperCase());
  }
  return Array.from(symbols);
}

function normalizeFinnhubTrade(
  t: FinnhubCongressTrade
): NormalizedTrade | null {
  if (!t.name || !t.transactionDate) return null;
  const chamber: "house" | "senate" =
    (t.position ?? "").toLowerCase().includes("senator") ? "senate" : "house";
  const sideRaw = (t.transactionType ?? "").toLowerCase();
  const side: NormalizedTrade["side"] = sideRaw.includes("purchase")
    ? "purchase"
    : sideRaw.includes("sale") || sideRaw.includes("sell")
    ? "sale"
    : sideRaw.includes("exchange")
    ? "exchange"
    : "other";
  const slug = t.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const dateTraded = parseDate(t.transactionDate);
  if (!dateTraded) return null;
  const dateReported = parseDate(t.filingDate);
  const ticker = (t.symbol ?? "").toUpperCase() || null;
  const amountRange =
    t.amountFrom != null && t.amountTo != null
      ? `$${t.amountFrom.toLocaleString()} - $${t.amountTo.toLocaleString()}`
      : null;

  const fingerprint = createHash("sha256")
    .update(
      [
        chamber,
        t.name,
        dateTraded,
        ticker ?? "",
        t.assetName ?? "",
        side,
        amountRange ?? "",
        (t.ownerType ?? "").toLowerCase(),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);

  return {
    id: fingerprint,
    legislator: t.name,
    legislatorSlug: slug,
    chamber,
    state: t.state ?? null,
    party: t.party ?? null,
    ticker,
    assetName: t.assetName ?? null,
    assetType: null,
    side,
    amountRange,
    amountMin: t.amountFrom ?? null,
    amountMax: t.amountTo ?? null,
    ownerType: t.ownerType?.toLowerCase() ?? null,
    dateTraded,
    dateReported,
    comment: t.comment ?? null,
    source: "finnhub",
  };
}

function countTrades(): number {
  return (
    db
      .select({ count: schema.congressTrades.id })
      .from(schema.congressTrades)
      .all().length
  );
}

async function fetchRaw(url: string): Promise<RawTrade[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Household Financial Assistant - personal use",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected payload (not an array)");
  }
  return data;
}

type NormalizedTrade = {
  id: string;
  legislator: string;
  legislatorSlug: string;
  chamber: "house" | "senate";
  state: string | null;
  party: string | null;
  ticker: string | null;
  assetName: string | null;
  assetType: string | null;
  side: "purchase" | "sale" | "exchange" | "other";
  amountRange: string | null;
  amountMin: number | null;
  amountMax: number | null;
  ownerType: string | null;
  dateTraded: string;
  dateReported: string | null;
  comment: string | null;
  source: string;
};

function normalizeTrade(
  raw: RawTrade,
  chamber: "senate" | "house",
  source: string
): NormalizedTrade | null {
  // Senate / House watcher datasets use slightly different field names.
  // We unify them here.
  const legislator = String(
    raw.senator ?? raw.representative ?? raw.name ?? raw.member ?? ""
  ).trim();
  if (!legislator) return null;
  const dateTraded = parseDate(
    raw.transaction_date ?? raw.tradeDate ?? raw.transactionDate
  );
  if (!dateTraded) return null;

  const dateReported = parseDate(
    raw.disclosure_date ?? raw.reportDate ?? raw.disclosureDate
  );
  const ticker = cleanTicker(String(raw.ticker ?? raw.symbol ?? ""));
  const assetName = String(
    raw.asset_description ?? raw.assetDescription ?? raw.description ?? ""
  ).trim() || null;
  const assetType =
    String(raw.asset_type ?? raw.assetType ?? "").trim() || null;
  const sideRaw = String(raw.type ?? raw.transaction_type ?? raw.transactionType ?? "")
    .trim()
    .toLowerCase();
  const side: NormalizedTrade["side"] = sideRaw.includes("purchase")
    ? "purchase"
    : sideRaw.includes("sale") || sideRaw.includes("sell")
    ? "sale"
    : sideRaw.includes("exchange")
    ? "exchange"
    : "other";

  const amountRange = String(raw.amount ?? "").trim() || null;
  const { min, max } = parseAmountRange(amountRange);

  const ownerType =
    String(raw.owner ?? "").trim().toLowerCase() || null;
  const comment = String(raw.comment ?? "").trim() || null;
  const state = String(raw.state ?? "").trim() || null;
  const party = String(raw.party ?? "").trim() || null;

  const slug = legislator
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const fingerprint = createHash("sha256")
    .update(
      [
        chamber,
        legislator,
        dateTraded,
        ticker ?? "",
        assetName ?? "",
        side,
        amountRange ?? "",
        ownerType ?? "",
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);

  return {
    id: fingerprint,
    legislator,
    legislatorSlug: slug,
    chamber,
    state,
    party,
    ticker,
    assetName,
    assetType,
    side,
    amountRange,
    amountMin: min,
    amountMax: max,
    ownerType,
    dateTraded,
    dateReported,
    comment,
    source,
  };
}

function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Many possible formats: "2024-03-15", "03/15/2024", "2024-03-15T00:00:00"
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const slash = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[1]}-${slash[2]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function cleanTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!t || t === "--" || t === "N/A" || t === "NONE") return null;
  // Many disclosures wrap tickers in odd characters; strip.
  const cleaned = t.replace(/[^A-Z.\-]/g, "");
  if (!cleaned || cleaned.length > 10) return null;
  return cleaned;
}

function parseAmountRange(s: string | null): { min: number | null; max: number | null } {
  if (!s) return { min: null, max: null };
  // Common formats:
  //   "$1,001 - $15,000"
  //   "$1,001 - $15,000+"
  //   "$50,000,001 +"
  //   "Over $50,000,000"
  const nums = s.replace(/[,$]/g, "").match(/\d+/g);
  if (!nums || nums.length === 0) return { min: null, max: null };
  if (nums.length === 1) {
    const v = parseFloat(nums[0]);
    return { min: v, max: null };
  }
  return { min: parseFloat(nums[0]), max: parseFloat(nums[1]) };
}
