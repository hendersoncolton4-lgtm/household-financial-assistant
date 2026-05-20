"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ScanButton({ lastScannedAt }: { lastScannedAt: number | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    total: number;
    inserted: number;
    refreshed: number;
  } | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/findings/scan", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan failed");
        return;
      }
      setReport({
        total: data.total,
        inserted: data.inserted,
        refreshed: data.refreshed,
      });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={busy || pending}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Scanning…" : "Scan now"}
      </button>
      {report && (
        <div className="text-xs text-emerald-300">
          {report.total} finding{report.total === 1 ? "" : "s"} (+{report.inserted} new, ~
          {report.refreshed} refreshed)
        </div>
      )}
      {!report && lastScannedAt && (
        <div className="text-xs text-slate-500">
          Last scan: {new Date(lastScannedAt).toLocaleString()}
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
