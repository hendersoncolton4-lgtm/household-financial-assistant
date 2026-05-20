"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncFundButton({ cik }: { cik: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/funds/${cik}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.warning) {
        setError(data.warning);
      } else {
        setInfo(
          `Synced ${data.filingsSynced} new filing${data.filingsSynced === 1 ? "" : "s"}.`
        );
      }
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
        onClick={sync}
        disabled={busy || pending}
        className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Syncing… (10–30s)" : "Sync 13F filings"}
      </button>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && (
        <div className="max-w-xs text-right text-xs text-amber-300">{error}</div>
      )}
    </div>
  );
}
