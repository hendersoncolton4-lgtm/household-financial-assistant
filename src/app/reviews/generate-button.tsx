"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GenerateReviewButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to generate");
      } else {
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
        onClick={onClick}
        disabled={busy || pending}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Generating… (10–20s)" : "Generate review"}
      </button>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
    </div>
  );
}
