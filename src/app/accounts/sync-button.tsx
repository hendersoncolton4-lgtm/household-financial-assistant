"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
      } else {
        setResult(
          `Synced ${data.items} institution(s): +${data.added}, ~${data.modified}, -${data.removed}`
        );
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={sync}
        disabled={busy || pending}
        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Syncing…" : "Sync now"}
      </button>
      {result && <div className="mt-2 text-xs text-emerald-300">{result}</div>}
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
