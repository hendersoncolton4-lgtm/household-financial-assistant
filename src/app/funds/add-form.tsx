"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const SUGGESTED = [
  { cik: "0001067983", label: "Berkshire Hathaway (Warren Buffett)" },
  { cik: "0001336528", label: "Pershing Square (Bill Ackman)" },
  { cik: "0001167483", label: "Tiger Global Management" },
  { cik: "0001037389", label: "Renaissance Technologies" },
  { cik: "0001697748", label: "ARK Investment Management (Cathie Wood)" },
  { cik: "0001649339", label: "Scion Asset Management (Michael Burry)" },
];

export function AddFundForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cik, setCik] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function addFund(rawCik: string) {
    const clean = rawCik.replace(/\D/g, "");
    if (!clean) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cik: clean }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setInfo(`Added ${data.name}.`);
      setCik("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addFund(cik);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[260px]">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Add a fund by SEC CIK
          </label>
          <input
            value={cik}
            onChange={(e) => setCik(e.target.value)}
            placeholder="e.g. 0001067983"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || pending || !cik.trim()}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy || pending ? "Adding…" : "Add"}
        </button>
      </form>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Quick add
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button
              key={s.cik}
              onClick={() => addFund(s.cik)}
              disabled={busy || pending}
              className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800 disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {info && (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}
