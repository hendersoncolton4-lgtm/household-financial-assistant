import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { AddFundForm } from "./add-form";

export const dynamic = "force-dynamic";

export default function FundsPage() {
  const funds = db
    .select()
    .from(schema.funds)
    .orderBy(asc(schema.funds.name))
    .all();

  // Pull the latest filing for each fund for the summary line
  const summaries = funds.map((f) => {
    const latest = db
      .select()
      .from(schema.fundFilings)
      .where(eq(schema.fundFilings.cik, f.cik))
      .orderBy(desc(schema.fundFilings.reportDate))
      .limit(1)
      .get();
    return { fund: f, latest };
  });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Funds we follow
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Add hedge funds and asset managers by SEC CIK to track their 13F
          filings. Filings come out ~45 days after each quarter-end and only
          cover long US equity positions — they don't capture options, shorts,
          or mid-quarter trades. Useful as research input, not strategy.
        </p>
      </header>

      <AddFundForm />

      {funds.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            No funds yet. Add one above by pasting a CIK.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            <strong className="text-slate-300">Example to try:</strong>{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5">0001067983</code>{" "}
            (Berkshire Hathaway).
            <br />
            Find any CIK at{" "}
            <a
              href="https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 underline"
            >
              SEC EDGAR company search
            </a>
            .
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {summaries.map(({ fund, latest }) => (
            <li
              key={fund.cik}
              className="rounded-lg border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700"
            >
              <Link href={`/funds/${fund.cik}`} className="block p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-100">
                      {fund.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      CIK {fund.cik}
                    </div>
                  </div>
                  {latest && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        Latest 13F · {latest.reportDate}
                      </div>
                      <div className="text-sm font-semibold text-slate-100">
                        {formatCurrency(latest.totalValue)}{" "}
                        <span className="text-xs font-normal text-slate-500">
                          · {latest.holdingsCount} positions
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {!latest && (
                  <div className="mt-2 text-xs text-amber-300">
                    No filings synced yet — open the fund and hit Sync.
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
