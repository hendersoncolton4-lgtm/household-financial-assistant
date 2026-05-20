"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TAX_ACCOUNT_LABELS, type TaxAccountType } from "@/lib/db/schema";

export function TaxContributionForm({
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
      year: parseInt(String(fd.get("year") ?? ""), 10),
      person: String(fd.get("person") ?? ""),
      accountType: String(fd.get("accountType") ?? ""),
      amount: parseFloat(String(fd.get("amount") ?? "")),
      notes: String(fd.get("notes") ?? ""),
    };
    try {
      const res = await fetch("/api/tax-contributions", {
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

  const currentYear = new Date().getFullYear();

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-6"
    >
      <h3 className="col-span-full text-sm font-semibold text-slate-100">
        Log a contribution
      </h3>
      <label className="block sm:col-span-1">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">Year</span>
        <input
          name="year"
          type="number"
          defaultValue={currentYear}
          className={inputCls}
        />
      </label>
      <label className="block sm:col-span-1">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">Person</span>
        <select name="person" defaultValue="primary" className={inputCls}>
          <option value="primary">{primaryName}</option>
          <option value="secondary">{secondaryName}</option>
          <option value="household">Household (HSA, 529)</option>
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">Account</span>
        <select name="accountType" required className={inputCls} defaultValue="401k">
          {Object.entries(TAX_ACCOUNT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-1">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">Amount</span>
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          placeholder="500"
          className={inputCls}
        />
      </label>
      <div className="block sm:col-span-1 sm:flex sm:items-end">
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      <label className="block sm:col-span-6">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
          Notes (optional)
        </span>
        <input
          name="notes"
          placeholder="e.g. March payroll deferral, payroll deduction line item"
          className={inputCls}
        />
      </label>
      {error && (
        <div className="col-span-full rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none";
