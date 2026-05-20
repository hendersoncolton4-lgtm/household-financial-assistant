"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MimicFundButton({ cik, fundName }: { cik: string; fundName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [topN, setTopN] = useState(10);
  const [allocationPct, setAllocationPct] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function mimic() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/funds/${cik}/mimic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topN, allocation: allocationPct / 100 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setInfo(
        `Queued ${data.created} proposal${data.created === 1 ? "" : "s"} for ${fundName}'s top ${topN} positions. Review at /trading.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setOpen(true)}
          className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/60"
        >
          Mimic this fund (paper)
        </button>
        {info && (
          <a href="/trading" className="text-xs text-emerald-300 underline">
            {info}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 rounded-md border border-slate-700 bg-slate-900 p-3 text-xs">
      <div className="text-slate-200">
        Generate proposals to mimic top positions:
      </div>
      <label className="flex items-center gap-2 text-slate-300">
        Top
        <input
          type="number"
          min={1}
          max={30}
          value={topN}
          onChange={(e) => setTopN(parseInt(e.target.value, 10) || 1)}
          className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
        />
        positions
      </label>
      <label className="flex items-center gap-2 text-slate-300">
        Allocate
        <input
          type="number"
          min={1}
          max={100}
          step={1}
          value={allocationPct}
          onChange={(e) => setAllocationPct(parseFloat(e.target.value) || 1)}
          className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
        />
        % of paper buying power
      </label>
      <div className="flex gap-2">
        <button
          onClick={mimic}
          disabled={busy || pending}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy || pending ? "Generating…" : "Generate proposals"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
      {info && (
        <a href="/trading" className="text-emerald-300 underline">
          {info}
        </a>
      )}
      {error && <div className="text-red-400">{error}</div>}
    </div>
  );
}
