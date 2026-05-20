"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from "@/lib/db/schema";

type CardProps = {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice: number | null;
  estimatedValue: number | null;
  rationale: string;
  riskNotes: string | null;
  status: ProposalStatus;
  alpacaOrderStatus: string | null;
  createdAt: number;
};

export function ProposalCard({ proposal: p }: { proposal: CardProps }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function action(kind: "approve" | "reject" | "cancel") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${p.id}/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(null);
    }
  }

  const sideClass = p.side === "buy" ? "text-emerald-300" : "text-rose-300";
  const sideBg =
    p.side === "buy"
      ? "border-emerald-700/50 bg-emerald-950/20"
      : "border-rose-700/50 bg-rose-950/20";

  return (
    <article className={`rounded-lg border ${sideBg} p-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sideClass}`}
            >
              {p.side}
            </span>
            <Link
              href={`/research/${p.symbol}`}
              className="text-base font-bold text-slate-100 hover:underline"
            >
              {p.symbol}
            </Link>
            <span className="text-sm text-slate-300">
              × {p.quantity} share{p.quantity === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-500">
              {p.orderType}{p.limitPrice ? ` @ $${p.limitPrice.toFixed(2)}` : " · best available"}
            </span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
              {PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Proposed {new Date(p.createdAt).toLocaleString()}
            {p.alpacaOrderStatus && ` · Alpaca: ${p.alpacaOrderStatus}`}
          </div>
        </div>
        {p.estimatedValue != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Estimated value
            </div>
            <div className="text-lg font-bold text-slate-100">
              {formatCurrency(p.estimatedValue)}
            </div>
          </div>
        )}
      </header>

      <section className="mt-3 space-y-2 text-sm text-slate-300">
        <div>
          <span className="font-semibold text-slate-200">Why:</span> {p.rationale}
        </div>
        {p.riskNotes && (
          <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Risk notes:</span>{" "}
            {p.riskNotes}
          </div>
        )}
      </section>

      <footer className="mt-4 flex flex-wrap items-center gap-2">
        {p.status === "pending" && (
          <>
            <button
              onClick={() => action("approve")}
              disabled={busy !== null || pending}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {busy === "approve" ? "Submitting…" : "Approve & submit (paper)"}
            </button>
            <button
              onClick={() => action("reject")}
              disabled={busy !== null || pending}
              className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              {busy === "reject" ? "Rejecting…" : "Reject"}
            </button>
          </>
        )}
        {p.status === "approved" && (
          <button
            onClick={() => action("cancel")}
            disabled={busy !== null || pending}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel order"}
          </button>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </footer>
    </article>
  );
}
