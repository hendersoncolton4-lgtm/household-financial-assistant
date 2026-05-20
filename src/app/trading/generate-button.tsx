"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GenerateProposalButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [request, setRequest] = useState("");

  async function onClick(freeform?: string) {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (freeform && freeform.trim()) body.request = freeform.trim();
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setShowRequest(false);
      setRequest("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {showRequest ? (
        <div className="flex flex-col items-end gap-2">
          <input
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="e.g. find a value play under $100, or trim my biggest position"
            className="w-80 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onClick(request)}
              disabled={busy || pending}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {busy || pending ? "Generating… (10–20s)" : "Generate"}
            </button>
            <button
              onClick={() => setShowRequest(false)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onClick()}
            disabled={busy || pending}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {busy || pending ? "Generating… (10–20s)" : "Generate proposal"}
          </button>
          <button
            onClick={() => setShowRequest(true)}
            disabled={busy || pending}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            …with prompt
          </button>
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
