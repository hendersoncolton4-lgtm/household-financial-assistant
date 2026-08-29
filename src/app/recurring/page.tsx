import Link from "next/link";
import { getCategoryMap } from "@/lib/categories";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAccountMap, getTransactionsSince } from "@/lib/transactions";
import {
  CADENCE_LABEL,
  detectRecurring,
  summarizeRecurring,
  type Cadence,
  type RecurringPattern,
} from "@/lib/recurring";

export const dynamic = "force-dynamic";

export default function RecurringPage() {
  // Pull 6 months of transactions so we can spot annual + quarterly patterns.
  const txns = getTransactionsSince(200);
  const accountMap = getAccountMap();
  const categoryMap = getCategoryMap();

  const patterns = detectRecurring(txns, accountMap, categoryMap);
  const summary = summarizeRecurring(patterns);
  const incoming = patterns.filter((p) => p.direction === "in");
  const outgoing = patterns.filter((p) => p.direction === "out");
  const net = summary.monthlyIncome - summary.monthlyOutflow;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Recurring transactions
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Automatically-detected patterns from the last 6 months — things that
          hit on a regular cadence (weekly, bi-weekly, monthly, quarterly,
          annual). Includes both money coming in (paychecks, dividends,
          transfers in) and going out (subscriptions, bills, loan payments).
          Amounts are normalized to a monthly figure so you can compare.
        </p>
      </section>

      {patterns.length === 0 ? (
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
              label="Monthly income (recurring)"
              value={formatCurrency(summary.monthlyIncome)}
              sublabel={`${summary.incomeCount} pattern${summary.incomeCount === 1 ? "" : "s"}`}
              positive
            />
            <Stat
              label="Monthly outflow (recurring)"
              value={formatCurrency(summary.monthlyOutflow)}
              sublabel={`${summary.outflowCount} pattern${summary.outflowCount === 1 ? "" : "s"}`}
              negative
            />
            <Stat
              label="Net recurring / month"
              value={formatCurrency(net)}
              positive={net >= 0}
              negative={net < 0}
            />
          </section>

          {incoming.length > 0 && (
            <PatternSection
              title={`Money coming in (${incoming.length})`}
              subtitle="Paychecks, dividends, transfers in, refunds, etc."
              patterns={incoming}
              variant="income"
            />
          )}

          {outgoing.length > 0 && (
            <PatternSection
              title={`Money going out (${outgoing.length})`}
              subtitle="Sorted by monthly cost — biggest at the top."
              patterns={outgoing}
              variant="outflow"
            />
          )}

          <section className="rounded-md border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
            <strong className="text-slate-300">How this works:</strong> the app
            groups transactions by merchant, checks whether 3+ occurrences share
            a similar amount (within 25%) and land on a regular cadence, and
            classifies the cadence as weekly / bi-weekly / monthly / quarterly /
            annual. If a pattern feels wrong — a variable-amount bill flagged as
            recurring, or a merchant it missed — that's a signal we can tune the
            heuristics. Tell me and I'll adjust.
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
  variant,
}: {
  title: string;
  subtitle: string;
  patterns: RecurringPattern[];
  variant: "income" | "outflow";
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
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
              <th className="px-4 py-2">Next expected</th>
              <th className="px-4 py-2 text-right">Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {patterns.map((p) => (
              <PatternRow key={`${p.direction}:${p.merchant}`} p={p} variant={variant} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PatternRow({
  p,
  variant,
}: {
  p: RecurringPattern;
  variant: "income" | "outflow";
}) {
  const amountClass =
    variant === "income" ? "text-emerald-400" : "text-slate-100";
  const monthlyClass =
    variant === "income"
      ? "text-emerald-300 font-semibold"
      : "text-slate-100 font-semibold";

  return (
    <tr className="hover:bg-slate-800/30">
      <td className="px-4 py-2">
        <div className="font-medium text-slate-100">{p.merchant}</div>
        {p.accountName && (
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {p.accountName}
          </div>
        )}
        {p.amountVariance > 0.15 && (
          <div className="mt-0.5 text-[10px] text-amber-400">
            ± {(p.amountVariance * 100).toFixed(0)}% variance
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        <CadenceBadge cadence={p.cadence} />
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right ${amountClass}`}>
        {formatCurrency(p.medianAmount)}
      </td>
      <td className={`whitespace-nowrap px-4 py-2 text-right ${monthlyClass}`}>
        {formatCurrency(p.monthlyAmount)}
      </td>
      <td className="px-4 py-2 text-xs text-slate-400">
        {p.categoryLabel ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
        {formatDate(p.lastDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
        {formatDate(p.nextExpectedDate)}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right text-xs text-slate-500">
        {p.count}×
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
