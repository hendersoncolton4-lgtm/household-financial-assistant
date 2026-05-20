import { XMLParser } from "fast-xml-parser";

/**
 * SEC EDGAR client. EDGAR is free and public, but requires a descriptive
 * User-Agent header with a contact email — they enforce ~10 req/sec.
 * Documentation: https://www.sec.gov/os/accessing-edgar-data
 */

const USER_AGENT =
  "Household Financial Assistant - personal use - contact@example.com";

function headers() {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
}

/** Pad a CIK to 10 digits, leading zeros. SEC's APIs require this. */
export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

export type FilingMeta = {
  accessionNumber: string;
  formType: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
  primaryDocDescription: string;
};

/**
 * Fetch the SEC submissions JSON for a fund. Returns recent filings,
 * filtered to a specific form type if provided.
 */
export async function getRecentFilings(
  cik: string,
  formType = "13F-HR",
  limit = 8
): Promise<FilingMeta[]> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`SEC submissions fetch failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    cik: number;
    name: string;
    filings: {
      recent: {
        accessionNumber: string[];
        filingDate: string[];
        reportDate: string[];
        primaryDocument: string[];
        primaryDocDescription: string[];
        form: string[];
      };
    };
  };
  const r = data.filings.recent;
  const out: FilingMeta[] = [];
  for (let i = 0; i < r.accessionNumber.length; i++) {
    if (r.form[i] !== formType && r.form[i] !== `${formType}/A`) continue;
    out.push({
      accessionNumber: r.accessionNumber[i],
      formType: r.form[i],
      filingDate: r.filingDate[i],
      reportDate: r.reportDate[i],
      primaryDocument: r.primaryDocument[i],
      primaryDocDescription: r.primaryDocDescription[i],
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Quick survey of what form types a CIK has filed — used to explain to the
 * user when a sync turned up no 13F-HRs (e.g., they added an individual or
 * a company that doesn't manage portfolios).
 */
export async function getFormTypeSummary(
  cik: string
): Promise<Map<string, number>> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`SEC submissions fetch failed (${res.status})`);
  const data = (await res.json()) as {
    filings: { recent: { form: string[] } };
  };
  const counts = new Map<string, number>();
  for (const f of data.filings.recent.form) {
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return counts;
}

/** Just the fund's name from the submissions JSON. */
export async function getFundName(cik: string): Promise<string> {
  const padded = padCik(cik);
  const url = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(
      `SEC fund lookup failed for CIK ${padded} (${res.status}). Check the CIK is correct.`
    );
  }
  const data = (await res.json()) as { name?: string };
  return data.name ?? `CIK ${padded}`;
}

export type ParsedInfoTable = {
  /** Name of the issuer as reported (often UPPERCASE) */
  issuerName: string;
  cusip: string | null;
  shares: number;
  /** Reported value in dollars (SEC reports in thousands; we multiply). */
  value: number;
};

/**
 * Fetch a 13F filing's info-table XML and parse the holdings.
 * The info table lives in the filing's directory; we find it via the
 * accession's index.json.
 */
export async function fetchAndParseInfoTable(
  cik: string,
  accessionNumber: string
): Promise<ParsedInfoTable[]> {
  const cikInt = String(parseInt(cik, 10)); // strip leading zeros for filing URL
  const accNoDashes = accessionNumber.replace(/-/g, "");
  // The directory listing for a filing lives at .../index.json (not the
  // accession-prefixed variant — that returns 404).
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDashes}/index.json`;
  const indexRes = await fetch(indexUrl, { headers: headers() });
  if (!indexRes.ok) {
    throw new Error(`SEC filing index fetch failed (${indexRes.status})`);
  }
  const index = (await indexRes.json()) as {
    directory: { item: Array<{ name: string; size?: string }> };
  };

  // Find the info table XML. It's almost always an .xml file that isn't the
  // primary_doc.xml cover page. Heuristic: pick the LARGEST .xml — info
  // tables are usually thousands of lines, cover pages are short.
  const xmls = index.directory.item.filter(
    (i) =>
      i.name.toLowerCase().endsWith(".xml") &&
      i.name.toLowerCase() !== "primary_doc.xml"
  );
  if (xmls.length === 0) {
    throw new Error("No info-table XML found in this filing.");
  }
  xmls.sort(
    (a, b) => parseInt(b.size ?? "0", 10) - parseInt(a.size ?? "0", 10)
  );
  const infoTableFile = xmls[0].name;
  const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDashes}/${infoTableFile}`;
  const xmlRes = await fetch(xmlUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/xml" },
  });
  if (!xmlRes.ok) {
    throw new Error(`SEC info-table fetch failed (${xmlRes.status})`);
  }
  const xml = await xmlRes.text();
  return parseInfoTable(xml);
}

/**
 * Parse the 13F info-table XML. Strips XML namespace prefixes so we don't
 * have to know whether the filing used `ns1:` or `infoTable:` or none.
 */
export function parseInfoTable(xml: string): ParsedInfoTable[] {
  // Strip namespace prefixes — Plaid filings use various prefixes (ns1:,
  // infoTable:, etc.) and fast-xml-parser preserves them which makes our
  // lookups annoying.
  const stripped = xml.replace(/<\/?[\w]+:/g, (m) => m.replace(/[\w]+:/, ""));
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: true,
    isArray: (name) => name === "infoTable",
  });
  const parsed = parser.parse(stripped) as {
    informationTable?: { infoTable?: RawInfoTable[] };
    infoTable?: RawInfoTable[];
  };
  const items =
    parsed.informationTable?.infoTable ?? parsed.infoTable ?? [];
  const out: ParsedInfoTable[] = [];
  for (const it of items) {
    const issuerName = String(it.nameOfIssuer ?? "").trim();
    if (!issuerName) continue;
    const cusip = it.cusip ? String(it.cusip).trim() : null;
    const sharesRaw = it.shrsOrPrnAmt?.sshPrnamt;
    const shares = Number(sharesRaw ?? 0);
    // SEC changed 13F reporting in 2023+ to report value in actual dollars
    // (no longer thousands). Modern filings have raw dollar values; older
    // filings (pre-Q3 2023) had thousands. For now we treat all as dollars
    // — accurate for any user adding funds today.
    const value = Number(it.value ?? 0);
    if (!Number.isFinite(shares) || !Number.isFinite(value)) continue;
    out.push({ issuerName, cusip, shares, value });
  }
  return out;
}

type RawInfoTable = {
  nameOfIssuer?: string;
  cusip?: string;
  value?: string | number;
  shrsOrPrnAmt?: {
    sshPrnamt?: string | number;
    sshPrnamtType?: string;
  };
};

/**
 * SEC's free company_tickers.json gives us a CIK→ticker→name table. We use
 * it for best-effort name→ticker resolution during 13F sync. Cached
 * in-memory; refreshed lazily once per process.
 */
let tickerCache: Array<{ ticker: string; nameKey: string }> | null = null;

export async function resolveTicker(issuerName: string): Promise<string | null> {
  const map = await loadTickerMap();
  const key = normalizeIssuerName(issuerName);
  // Exact match first
  const exact = map.find((m) => m.nameKey === key);
  if (exact) return exact.ticker;
  // Prefix match — handles "APPLE INC" → "APPLE INC." kind of cases
  const prefix = map.find(
    (m) => m.nameKey.startsWith(key) || key.startsWith(m.nameKey)
  );
  return prefix?.ticker ?? null;
}

async function loadTickerMap() {
  if (tickerCache) return tickerCache;
  const url = "https://www.sec.gov/files/company_tickers.json";
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`SEC ticker map fetch failed (${res.status})`);
  }
  const data = (await res.json()) as Record<
    string,
    { ticker: string; title: string }
  >;
  tickerCache = Object.values(data).map((v) => ({
    ticker: v.ticker.toUpperCase(),
    nameKey: normalizeIssuerName(v.title),
  }));
  return tickerCache;
}

/** Normalize an issuer name to a comparison-friendly key. */
function normalizeIssuerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,&'/\\-]/g, " ")
    .replace(/\b(?:INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LP|LTD|PLC|HOLDINGS?|GROUP|TRUST|FUND|CLASS\s+[A-Z])\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
