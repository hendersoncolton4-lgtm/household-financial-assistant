"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function CongressSyncButton({
  totalCount,
  lastReported,
}: {
  totalCount: number;
  lastReported: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setInfo(null);
    setError(null);
    try {
      const res = await fetch("/api/congress/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      const parts = [
        `Fetched ${data.fetched}`,
        `+${data.inserted} new`,
        `${data.skipped} dupes`,
      ];
      if (data.errors?.length) {
        parts.push(`warnings: ${data.errors.length}`);
      }
      setInfo(parts.join(", "));
      if (data.errors?.length) {
        setError(data.errors.join("; "));
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
        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Syncing… (10–30s)" : totalCount === 0 ? "Sync now" : "Re-sync"}
      </button>
      {totalCount > 0 && !info && (
        <div className="text-xs text-slate-500">
          {totalCount.toLocaleString()} trades in DB
          {lastReported && ` · last reported ${lastReported}`}
        </div>
      )}
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && (
        <div className="max-w-xs text-right text-xs text-amber-300">{error}</div>
      )}
    </div>
  );
}
