"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";

type FindingProps = {
  id: string;
  type: string;
  typeLabel: string;
  severity: string;
  title: string;
  detail: string;
  suggestion: string | null;
  amount: number | null;
  status: string;
  snoozedUntil: number | null;
};

export function FindingCard({ finding }: { finding: FindingProps }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: string, snoozeDays?: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, snoozeDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const sevClass = SEV_CLASSES[finding.severity] ?? SEV_CLASSES.low;
  const statusBadge = STATUS_BADGE[finding.status];

  return (
    <article className={`rounded-lg border p-5 ${sevClass.border} ${sevClass.bg}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sevClass.badge}`}
          >
            {finding.severity}
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            {finding.typeLabel}
          </span>
          {statusBadge && (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {statusBadge}
              {finding.status === "snoozed" && finding.snoozedUntil && (
                <> · until {new Date(finding.snoozedUntil).toLocaleDateString()}</>
              )}
            </span>
          )}
        </div>
        {finding.amount != null && finding.amount > 0 && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Opportunity
            </div>
            <div className={`text-sm font-bold ${sevClass.amountText}`}>
              {formatCurrency(finding.amount)}
            </div>
          </div>
        )}
      </header>

      <h3 className="mt-2 text-base font-semibold text-slate-100">{finding.title}</h3>
      <p className="mt-1 text-sm text-slate-300">{finding.detail}</p>
      {finding.suggestion && (
        <p className="mt-2 rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
          <span className="font-semibold text-slate-200">Suggested action:</span>{" "}
          {finding.suggestion}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {finding.status === "new" ? (
          <>
            <button
              onClick={() => setStatus("acted")}
              disabled={busy || pending}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Mark handled
            </button>
            <button
              onClick={() => setStatus("snoozed", 30)}
              disabled={busy || pending}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Snooze 30 days
            </button>
            <button
              onClick={() => setStatus("dismissed")}
              disabled={busy || pending}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
            >
              Dismiss
            </button>
          </>
        ) : (
          <button
            onClick={() => setStatus("new")}
            disabled={busy || pending}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Reopen
          </button>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </article>
  );
}

const SEV_CLASSES: Record<
  string,
  { border: string; bg: string; badge: string; amountText: string }
> = {
  high: {
    border: "border-rose-700/70",
    bg: "bg-rose-950/30",
    badge: "bg-rose-500/20 text-rose-300",
    amountText: "text-rose-300",
  },
  medium: {
    border: "border-amber-700/70",
    bg: "bg-amber-950/20",
    badge: "bg-amber-500/20 text-amber-300",
    amountText: "text-amber-300",
  },
  low: {
    border: "border-slate-700",
    bg: "bg-slate-900",
    badge: "bg-slate-700 text-slate-300",
    amountText: "text-slate-300",
  },
};

const STATUS_BADGE: Record<string, string | null> = {
  new: null,
  acted: "Handled",
  dismissed: "Dismissed",
  snoozed: "Snoozed",
};
