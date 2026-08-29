import Link from "next/link";
import { getCategoryMap } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAccountMap, getTransactionsSince } from "@/lib/transactions";
import {
  CADENCE_LABEL,
  detectRecurring,
  getRecurringStatusMap,
  patternId,
  summarizeRecurring,
  type Cadence,
  type RecurringPattern,
} from "@/lib/recurring";
import { PatternActions } from "./pattern-actions";

export const dynamic = "force-dynamic";

type Bucket = "active" | "cancelled" | "hidden";

export default async function RecurringPage(props: PageProps<"/recurring">) {
  const sp = await props.searchParams;
  const showHidden = sp.hidden === "1";

  // Pull 6 months of transactions so we can spot annual + quarterly patterns.
  const txns = getTransactionsSince(200);
  const accountMap = getAccountMap();
  const categoryMap = getCategoryMap();

  const allPatterns = detectRecurring(txns, accountMap, categoryMap);
  const statusMap = getRecurringStatusMap();

  // Split by user-set status. Anything without an override is "active".
  const active: RecurringPattern[] = [];
  const cancelled: RecurringPattern[] = [];
  const hidden: RecurringPattern[] = [];
  for (const p of allPatterns) {
    const status = statusMap.get(patternId(p))?.status ?? "active";
    if (status === "cancelled") cancelled.push(p);
    else if (status === "hidden") hidden.push(p);
    else active.push(p);
  }

  const activeSummary = summarizeRecurring(active);
  const cancelledSummary = summarizeRecurring(cancelled);
  const activeNet = activeSummary.monthlyIncome - activeSummary.monthlyOutflow;
  const withCancelledNet =
    activeSummary.monthlyIncome +
    cancelledSummary.monthlyIncome -
    (activeSummary.monthlyOutflow + cancelledSummary.monthlyOutflow);

  const activeIn = active.filter((p) => p.direction === "in");
  const activeOut = active.filter((p) => p.direction === "out");
  const cancelledIn = cancelled.filter((p) => p.direction === "in");
  const cancelledOut = cancelled.filter((p) => p.direction === "out");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Recurring transactions
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Automatically-detected patterns from the last 6 months — things that
          hit on a regular cadence. Includes both money coming in and going
          out. Amounts are normalized to a monthly figure so you can compare.
          Click <strong>Cancelled</strong> on any row to move it to the
          Cancelled section — totals below the fold show what your recurring
          spend would look like if you kept those.
        </p>
      </section>

      {allPatterns.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          No recurring patterns detected yet. Need at least 3 occurrences of
          the same merchant with a regular cadence. Hit{" "}
          <Link href="/accounts" className="text-emerald-300 underline">
            Sync now
          </Link>{" "}
          if your data feels stale.
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Monthly income (active)"
              value={formatCurrency(activeSummary.monthlyIncome)}
              sublabel={`${activeSummary.incomeCount} pattern${activeSummary.incomeCount === 1 ? "" : "s"}`}
              positive
            />
            <Stat
              label="Monthly outflow (active)"
              value={formatCurrency(activeSummary.monthlyOutflow)}
              sublabel={`${activeSummary.outflowCount} pattern${activeSummary.outflowCount === 1 ? "" : "s"}`}
              negative
            />
            <Stat
              label="Net / month"
              value={formatCurrency(activeNet)}
              sublabel={
                cancelled.length > 0
                  ? `${formatCurrency(withCancelledNet)} if cancelled counted`
                  : undefined
              }
              positive={activeNet >= 0}
              negative={activeNet < 0}
            />
          </section>

          {activeIn.length > 0 && (
            <PatternSection
              title={`Money coming in (${activeIn.length})`}
              subtitle="Paychecks, dividends, transfers in, refunds, etc."
              patterns={activeIn}
              bucket="active"
              variant="income"
            />
          )}

          {activeOut.length > 0 && (
            <PatternSection
              title={`Money going out (${activeOut.length})`}
              subtitle="Sorted by monthly cost — biggest at the top."
              patterns={activeOut}
              bucket="active"
              variant="outflow"
            />
          )}

          {cancelled.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    Cancelled
                  </h2>
                  <p className="text-xs text-slate-500">
                    Moved here manually. Not counted in the main totals.
                    Reactivate any row to bring it back.
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  <span className="text-slate-500">Would add: </span>
                  <span className="text-emerald-400">
                    +{formatCurrency(cancelledSummary.monthlyIncome)}
                  </span>
                  <span className="text-slate-500"> in / </span>
                  <span className="text-rose-400">
                    {formatCurrency(cancelledSummary.monthlyOutflow)}
                  </span>
                  <span className="text-slate-500"> out per month</span>
                </div>
              </div>
              {cancelledIn.length > 0 && (
                <PatternSection
                  title={`Cancelled income (${cancelledIn.length})`}
                  subtitle=""
                  patterns={cancelledIn}
                  bucket="cancelled"
                  variant="income"
                  dim
                />
              )}
              {cancelledOut.length > 0 && (
                <PatternSection
                  title={`Cancelled outflow (${cancelledOut.length})`}
                  subtitle=""
                  patterns={cancelledOut}
                  bucket="cancelled"
                  variant="outflow"
                  dim
                />
              )}
            </section>
          )}

          {(hidden.length > 0 || showHidden) && (
            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Hidden</h2>
                  <p className="text-xs text-slate-500">
                    {hidden.length === 0
                      ? "Nothing hidden."
                      : `${hidden.length} pattern${hidden.length === 1 ? "" : "s"} hidden. Not counted anywhere.`}
                  </p>
                </div>
                <Link
                  href={showHidden ? "/recurring" : "/recurring?hidden=1"}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  {showHidden ? "Collapse hidden" : "Show hidden"}
                </Link>
              </div>
              {showHidden && hidden.length > 0 && (
                <PatternSection
                  title="Hidden patterns"
                  subtitle=""
                  patterns={hidden}
                  bucket="hidden"
                  variant="outflow"
                  dim
                />
              )}
            </section>
          )}

          {!showHidden && hidden.length === 0 && (
            <div className="text-center">
              <Link
                href="/recurring?hidden=1"
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Show hidden
              </Link>
            </div>
          )}

          <section className="rounded-md border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
            <strong className="text-slate-300">How this works:</strong> the app
            groups transactions by merchant + direction, checks whether 3+
            occurrences share a similar amount (within 25%) and land on a
            regular cadence, and classifies as weekly / bi-weekly / monthly /
            quarterly / annual. Marking a pattern <em>Cancelled</em> keeps it
            visible in a separate section so you can see the delta; marking it{" "}
            <em>Hidden</em> tucks it away entirely (toggle "Show hidden" to
            get it back).
          </section>
        </>
      )}
    </div>
  );
}

function PatternSection({
  title,
  subtitle,
  patterns,
  bucket,
  variant,
  dim,
}: {
  title: string;
  subtitle: string;
  patterns: RecurringPattern[];
  bucket: Bucket;
  variant: "income" | "outflow";
  dim?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-800 bg-slate-900 ${dim ? "opacity-70" : ""}`}
    >
      <header className="border-b border-slate-800 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Merchant</th>
              <th className="px-4 py-2">Cadence</th>
              <th className="px-4 py-2 text-right">Typical</th>
              <th className="px-4 py-2 text-right">Monthly</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Last seen</th>
              <th className="px-4 py-2 text-right">Seen</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {patterns.map((p) => (
              <PatternRow
                key={`${p.direction}:${p.merchant}`}
                p={p}
                bucket={bucket}
                variant={variant}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PatternRow({
  p,
  bucket,
  variant,
}: {
  p: RecurringPattern;
  bucket: Bucket;
  variant: "income" | "outflow";
}) {
  const amountClass =
    variant === "income" ? "text-emerald-400" : "text-slate-100";
  const monthlyClass =
    variant === "income"
      ? "text-emerald-300 font-semibold"
      : "text-slate-100 font-semibold";
  const dim = bucket !== "active";

  return (
    <tr className={`hover:bg-slate-800/30 ${dim ? "line-through decoration-slate-600 decoration-2" : ""}`}>
      <td className="px-4 py-2 no-underline">
        <div className="font-medium text-slate-100 [text-decoration:inherit]">
          {p.merchant}
        </div>
        {p.accountName && (
          <div className="text-[10px] uppercase tracking-wide text-slate-500 no-underline">
            {p.accountName}
          </div>
        )}
        {p.amountVariance > 0.15 && (
          <div className="mt-0.5 text-[10px] text-amber-400 no-underline">
            ± {(p.amountVariance * 100).toFixed(0)}% variance
          </div>
        )}
      </td>
      <td className="px-4 py-2 no-underline">
        <CadenceBadge cadence={p.cadence} />
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right ${amountClass}`}>
        {formatCurrency(p.medianAmount)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right ${monthlyClass}`}>
        {formatCurrency(p.monthlyAmount)}
      </td>
      <td className="px-4 py-2 text-xs text-slate-400 no-underline">
        {p.categoryLabel ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500 no-underline">
        {formatDate(p.lastDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-500 no-underline">
        {p.count}×
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right no-underline">
        <PatternActions
          direction={p.direction}
          merchant={p.merchant}
          currentStatus={bucket}
        />
      </td>
    </tr>
  );
}

function CadenceBadge({ cadence }: { cadence: Cadence }) {
  const styles: Record<Cadence, string> = {
    weekly: "bg-fuchsia-500/20 text-fuchsia-300",
    biweekly: "bg-sky-500/20 text-sky-300",
    monthly: "bg-emerald-500/20 text-emerald-300",
    quarterly: "bg-amber-500/20 text-amber-300",
    annual: "bg-slate-700 text-slate-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[cadence]}`}
    >
      {CADENCE_LABEL[cadence]}
    </span>
  );
}

function Stat({
  label,
  value,
  sublabel,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sublabel?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        positive
          ? "border-emerald-700/60 bg-emerald-950/20"
          : negative
          ? "border-rose-700/60 bg-rose-950/20"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-slate-100"
        }`}
      >
        {value}
      </div>
      {sublabel && (
        <div className="mt-0.5 text-[11px] text-slate-500">{sublabel}</div>
      )}
    </div>
  );
}
