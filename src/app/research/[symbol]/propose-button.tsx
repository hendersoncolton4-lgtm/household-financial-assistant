"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ProposeTradeButton({ symbol }: { symbol: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setInfo("Queued. Review at /trading.");
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
        className="rounded-md border border-emerald-700 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
      >
        {busy || pending ? "Generating…" : "Propose trade (paper)"}
      </button>
      {info && (
        <a href="/trading" className="text-xs text-emerald-400 hover:underline">
          {info}
        </a>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
