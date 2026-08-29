"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "active" | "cancelled" | "hidden";

/**
 * Small action buttons that flip a pattern's status. Used inline in each
 * row of the recurring page.
 */
export function PatternActions({
  direction,
  merchant,
  currentStatus,
}: {
  direction: "in" | "out";
  merchant: string;
  currentStatus: Status;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function set(status: Status) {
    setBusy(status);
    setError(null);
    try {
      const res = await fetch("/api/recurring/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, merchant, status }),
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
      setBusy(null);
    }
  }

  if (currentStatus === "active") {
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <button
          onClick={() => set("cancelled")}
          disabled={busy !== null || pending}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-400 hover:border-amber-900 hover:bg-amber-950/30 hover:text-amber-300 disabled:opacity-50"
          title="Move to Cancelled — still tracked, doesn't count in main totals"
        >
          {busy === "cancelled" ? "…" : "Cancelled"}
        </button>
        <button
          onClick={() => set("hidden")}
          disabled={busy !== null || pending}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50"
          title="Hide entirely — won't appear anywhere until you show hidden again"
        >
          {busy === "hidden" ? "…" : "Hide"}
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    );
  }

  // cancelled or hidden — just show a reactivate button
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button
        onClick={() => set("active")}
        disabled={busy !== null || pending}
        className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-50"
      >
        {busy === "active" ? "…" : "Reactivate"}
      </button>
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
