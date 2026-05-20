/**
 * Lightweight Finnhub client. Free tier = 60 calls/min, plenty for personal
 * use. We only call the endpoints we need; no SDK dependency.
 */

const BASE_URL = "https://finnhub.io/api/v1";

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    throw new Error(
      "Missing FINNHUB_API_KEY. Add it to .env.local — get a free key at https://finnhub.io"
    );
  }
  return key;
}

export type FinnhubCongressTrade = {
  name: string;
  symbol: string;
  transactionDate: string;
  filingDate: string;
  amountFrom: number;
  amountTo: number;
  ownerType: string;
  assetName: string;
  /** "Representative" | "Senator" */
  position: string;
  /** Free-form: "Purchase", "Sale (Full)", "Sale (Partial)", "Exchange" */
  transactionType: string;
  /** Optional state/party/district fields — Finnhub sometimes includes. */
  state?: string;
  party?: string;
  district?: string;
  /** Free-form filer notes when present. */
  comment?: string;
};

/**
 * Fetch recent congressional trading activity for a single symbol. Returns
 * an empty array if the symbol has no disclosed activity (common).
 */
export async function getCongressionalTrading(
  symbol: string
): Promise<FinnhubCongressTrade[]> {
  const url = `${BASE_URL}/stock/congressional-trading?symbol=${encodeURIComponent(symbol)}&token=${apiKey()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 429) {
    throw new Error("Finnhub rate-limited (60 calls/min on free tier). Try again in a minute.");
  }
  if (!res.ok) {
    throw new Error(`Finnhub call failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    data?: FinnhubCongressTrade[];
    error?: string;
  };
  if (data.error) {
    // Finnhub returns 200 OK with `{"error": "You don't have access..."}` for
    // premium endpoints on free keys. Surface this as a real failure.
    throw new Error(`Finnhub: ${data.error}`);
  }
  return data.data ?? [];
}
