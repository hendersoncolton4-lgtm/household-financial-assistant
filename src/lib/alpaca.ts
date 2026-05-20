/**
 * Lightweight Alpaca client for market data + news. We don't use the trading
 * endpoints here — that's Phase 6 (paper trading) and Phase 8 (real). All
 * calls go through the free IEX-grade data tier; SIP requires a paid plan
 * and isn't necessary for casual research.
 */

const DATA_URL = "https://data.alpaca.markets";
// Paper trading base for asset metadata + account info. Even when we later
// add real trading, asset lookups still work against the paper base.
const TRADING_URL =
  process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets";

function headers() {
  const key = process.env.ALPACA_API_KEY;
  const secret = process.env.ALPACA_SECRET;
  if (!key || !secret) {
    throw new Error(
      "Missing Alpaca credentials. Add ALPACA_API_KEY and ALPACA_SECRET to .env.local — get them at https://alpaca.markets after creating a paper-trading account."
    );
  }
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
    "Content-Type": "application/json",
  };
}

export type SnapshotData = {
  symbol: string;
  latestTradePrice: number | null;
  latestQuoteAsk: number | null;
  latestQuoteBid: number | null;
  dailyOpen: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  dailyClose: number | null;
  prevDailyClose: number | null;
  dailyVolume: number | null;
  /** % change from previous day's close to latest price. */
  changePercent: number | null;
  /** $ change from previous day's close to latest price. */
  changeAmount: number | null;
  asOf: string | null;
};

/**
 * Get latest price + daily/prev-day bar for one or more symbols.
 * Symbols should be uppercase already.
 */
export async function getSnapshots(
  symbols: string[]
): Promise<Record<string, SnapshotData>> {
  if (symbols.length === 0) return {};
  const url = `${DATA_URL}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca snapshots failed (${res.status}): ${await res.text()}`);
  }
  const raw = (await res.json()) as Record<string, RawSnapshot>;
  const out: Record<string, SnapshotData> = {};
  for (const [symbol, s] of Object.entries(raw)) {
    const latestPrice = s.latestTrade?.p ?? null;
    const prev = s.prevDailyBar?.c ?? null;
    out[symbol] = {
      symbol,
      latestTradePrice: latestPrice,
      latestQuoteAsk: s.latestQuote?.ap ?? null,
      latestQuoteBid: s.latestQuote?.bp ?? null,
      dailyOpen: s.dailyBar?.o ?? null,
      dailyHigh: s.dailyBar?.h ?? null,
      dailyLow: s.dailyBar?.l ?? null,
      dailyClose: s.dailyBar?.c ?? null,
      prevDailyClose: prev,
      dailyVolume: s.dailyBar?.v ?? null,
      changeAmount:
        latestPrice != null && prev != null ? latestPrice - prev : null,
      changePercent:
        latestPrice != null && prev != null && prev > 0
          ? (latestPrice - prev) / prev
          : null,
      asOf: s.latestTrade?.t ?? null,
    };
  }
  return out;
}

type RawSnapshot = {
  latestTrade?: { p: number; t: string };
  latestQuote?: { ap: number; bp: number; t: string };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number };
  prevDailyBar?: { c: number };
};

export type DailyBar = {
  date: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Fetch the last `days` daily bars for a symbol. Useful for showing a
 * recent-price summary without rendering a chart.
 */
export async function getRecentBars(symbol: string, days: number): Promise<DailyBar[]> {
  const end = new Date();
  const start = new Date();
  // Pull a bit extra to account for weekends/holidays so we don't come back
  // empty-handed if today is Sunday.
  start.setDate(start.getDate() - days - 7);
  const url = `${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start.toISOString()}&end=${end.toISOString()}&limit=${days + 7}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca bars failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { bars?: RawBar[] };
  const bars = (data.bars ?? []).map((b) => ({
    date: b.t,
    open: b.o,
    high: b.h,
    low: b.l,
    close: b.c,
    volume: b.v,
  }));
  return bars.slice(-days);
}

type RawBar = { t: string; o: number; h: number; l: number; c: number; v: number };

export type NewsArticle = {
  id: number;
  symbols: string[];
  headline: string;
  summary: string;
  source: string;
  url: string;
  createdAt: string;
};

/**
 * Recent news headlines for one or more symbols.
 */
export async function getNews(
  symbols: string[],
  limit = 10
): Promise<NewsArticle[]> {
  if (symbols.length === 0) return [];
  const url = `${DATA_URL}/v1beta1/news?symbols=${encodeURIComponent(symbols.join(","))}&limit=${limit}&sort=desc`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca news failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { news?: RawNews[] };
  return (data.news ?? []).map((n) => ({
    id: n.id,
    symbols: n.symbols ?? [],
    headline: n.headline,
    summary: n.summary ?? "",
    source: n.source ?? "",
    url: n.url ?? "",
    createdAt: n.created_at ?? n.updated_at ?? "",
  }));
}

type RawNews = {
  id: number;
  symbols?: string[];
  headline: string;
  summary?: string;
  source?: string;
  url?: string;
  created_at?: string;
  updated_at?: string;
};

export type AssetInfo = {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
  fractionable: boolean;
  status: string;
};

/**
 * List all active, tradable US equity assets. Called once to populate the
 * local cache that powers typeahead search.
 */
export async function listActiveAssets(): Promise<AssetInfo[]> {
  const url = `${TRADING_URL}/v2/assets?status=active&asset_class=us_equity`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca assets list failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as Array<{
    symbol: string;
    name: string;
    exchange: string;
    tradable: boolean;
    fractionable: boolean;
    status: string;
    class?: string;
  }>;
  return data.map((a) => ({
    symbol: a.symbol,
    name: a.name,
    exchange: a.exchange,
    tradable: a.tradable,
    fractionable: a.fractionable,
    status: a.status,
  }));
}

export type AccountInfo = {
  accountNumber: string;
  status: string;
  currency: string;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  equity: number;
  lastEquity: number;
  daytradeCount: number;
  isPatternDayTrader: boolean;
  isPaper: boolean;
};

/** Paper-trading account snapshot. */
export async function getAccount(): Promise<AccountInfo> {
  const url = `${TRADING_URL}/v2/account`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca account failed (${res.status}): ${await res.text()}`);
  }
  const d = (await res.json()) as Record<string, string | boolean | number>;
  return {
    accountNumber: String(d.account_number ?? ""),
    status: String(d.status ?? ""),
    currency: String(d.currency ?? "USD"),
    cash: parseFloat(String(d.cash ?? "0")),
    buyingPower: parseFloat(String(d.buying_power ?? "0")),
    portfolioValue: parseFloat(String(d.portfolio_value ?? "0")),
    equity: parseFloat(String(d.equity ?? "0")),
    lastEquity: parseFloat(String(d.last_equity ?? "0")),
    daytradeCount: Number(d.daytrade_count ?? 0),
    isPatternDayTrader: Boolean(d.pattern_day_trader),
    isPaper: TRADING_URL.includes("paper"),
  };
}

export type OrderInput = {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  timeInForce: "day" | "gtc";
  limitPrice?: number;
};

export type OrderStatus = {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  filledQty: number;
  filledAvgPrice: number | null;
  status: string;
  type: string;
  limitPrice: number | null;
  submittedAt: string;
  filledAt: string | null;
  failedAt: string | null;
};

function parseOrder(d: Record<string, string | number | null>): OrderStatus {
  return {
    id: String(d.id ?? ""),
    symbol: String(d.symbol ?? ""),
    side: String(d.side ?? ""),
    qty: parseFloat(String(d.qty ?? "0")),
    filledQty: parseFloat(String(d.filled_qty ?? "0")),
    filledAvgPrice:
      d.filled_avg_price != null ? parseFloat(String(d.filled_avg_price)) : null,
    status: String(d.status ?? ""),
    type: String(d.type ?? ""),
    limitPrice: d.limit_price != null ? parseFloat(String(d.limit_price)) : null,
    submittedAt: String(d.submitted_at ?? ""),
    filledAt: d.filled_at != null ? String(d.filled_at) : null,
    failedAt: d.failed_at != null ? String(d.failed_at) : null,
  };
}

export async function submitOrder(input: OrderInput): Promise<OrderStatus> {
  const url = `${TRADING_URL}/v2/orders`;
  const body: Record<string, unknown> = {
    symbol: input.symbol,
    qty: input.qty,
    side: input.side,
    type: input.type,
    time_in_force: input.timeInForce,
  };
  if (input.type === "limit" && input.limitPrice != null) {
    body.limit_price = input.limitPrice;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Alpaca submit order failed (${res.status}): ${await res.text()}`);
  }
  return parseOrder(await res.json());
}

export async function getOrder(orderId: string): Promise<OrderStatus> {
  const url = `${TRADING_URL}/v2/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Alpaca get order failed (${res.status}): ${await res.text()}`);
  }
  return parseOrder(await res.json());
}

export async function cancelOrder(orderId: string): Promise<void> {
  const url = `${TRADING_URL}/v2/orders/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, { method: "DELETE", headers: headers() });
  // 207 = partial cancel (some fills happened); 204 = full cancel. Both fine.
  if (!res.ok && res.status !== 207 && res.status !== 204) {
    throw new Error(`Alpaca cancel order failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Validate a ticker symbol and pull its display name.
 */
export async function lookupAsset(symbol: string): Promise<AssetInfo | null> {
  const url = `${TRADING_URL}/v2/assets/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { headers: headers() });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Alpaca asset lookup failed (${res.status}): ${await res.text()}`);
  }
  const a = (await res.json()) as {
    symbol: string;
    name: string;
    exchange: string;
    tradable: boolean;
    fractionable: boolean;
    status: string;
  };
  return {
    symbol: a.symbol,
    name: a.name,
    exchange: a.exchange,
    tradable: a.tradable,
    fractionable: a.fractionable,
    status: a.status,
  };
}
