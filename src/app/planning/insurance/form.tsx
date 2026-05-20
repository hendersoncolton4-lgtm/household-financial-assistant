"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSURANCE_TYPE_LABELS } from "@/lib/db/schema";

export function InsurancePolicyForm({
  primaryName,
  secondaryName,
}: {
  primaryName: string;
  secondaryName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      type: String(fd.get("type") ?? ""),
      insuredName: String(fd.get("insuredName") ?? ""),
      carrier: String(fd.get("carrier") ?? ""),
      coverageAmount: String(fd.get("coverageAmount") ?? ""),
      premiumMonthly: String(fd.get("premiumMonthly") ?? ""),
      beneficiary: String(fd.get("beneficiary") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    try {
      const res = await fetch("/api/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      e.currentTarget.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-3"
    >
      <h3 className="col-span-full text-sm font-semibold text-slate-100">Add a policy</h3>
      <label className="block">
        <span className={labelCls}>Type</span>
        <select name="type" required defaultValue="life_term" className={inputCls}>
          {Object.entries(INSURANCE_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Insured</span>
        <select name="insuredName" defaultValue="primary" className={inputCls}>
          <option value="primary">{primaryName}</option>
          <option value="secondary">{secondaryName}</option>
          <option value="household">Household</option>
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Carrier (optional)</span>
        <input name="carrier" placeholder="e.g. State Farm" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Coverage ($)</span>
        <input name="coverageAmount" type="number" step="1000" placeholder="500000" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Monthly premium ($)</span>
        <input name="premiumMonthly" type="number" step="0.01" placeholder="45" className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Beneficiary (optional)</span>
        <input name="beneficiary" placeholder="e.g. Spouse, then kids" className={inputCls} />
      </label>
      <label className="block sm:col-span-3">
        <span className={labelCls}>Notes (optional)</span>
        <input name="notes" className={inputCls} />
      </label>
      <div className="sm:col-span-3 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Adding…" : "Add policy"}
        </button>
      </div>
      {error && (
        <div className="sm:col-span-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none";
const labelCls = "block text-[10px] uppercase tracking-wide text-slate-500";
