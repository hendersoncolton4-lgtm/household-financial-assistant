"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { CategoryCell } from "./category-cell";

type Row = {
  id: string;
  date: string;
  name: string;
  merchantName: string | null;
  accountId: string;
  accountName: string;
  amount: number;
  isoCurrencyCode: string | null;
  pending: boolean;
  categoryKey: string | null;
  categoryLabel: string;
  merchantKey: string;
  merchantTxnCount: number;
};

type FilterOption = { key: string; label: string; count: number };
type CategoryOption = { key: string; label: string };

export function TransactionsView({
  rows,
  filterOptions,
  uncategorizedCount,
  currentFilter,
  categoryOptions,
}: {
  rows: Row[];
  filterOptions: FilterOption[];
  uncategorizedCount: number;
  currentFilter: string | null;
  categoryOptions: CategoryOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk-recategorize state
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const allVisibleSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected]
  );

  function setFilter(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete("category");
    } else {
      params.set("category", next);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/transactions?${qs}` : "/transactions");
      setSelected(new Set()); // clear selection when filter changes
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  async function applyBulk() {
    if (!bulkCategory || selected.size === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/transactions/bulk-categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
          categoryKey: bulkCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkError(data.error ?? "Failed");
        return;
      }
      setSelected(new Set());
      setBulkCategory("");
      startTransition(() => router.refresh());
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Filter
        </label>
        <select
          value={currentFilter ?? "all"}
          onChange={(e) => setFilter(e.target.value)}
          disabled={pending}
          className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
        >
          <option value="all">All categories</option>
          {uncategorizedCount > 0 && (
            <option value="uncategorized">
              — Uncategorized ({uncategorizedCount})
            </option>
          )}
          {filterOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label} ({o.count})
            </option>
          ))}
        </select>
        {currentFilter && (
          <button
            onClick={() => setFilter("all")}
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Bulk action bar (sticky-feel: only shows when selection > 0) */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950/60 p-3 backdrop-blur">
          <span className="text-sm font-medium text-emerald-200">
            {selected.size} selected
          </span>
          <span className="text-xs text-slate-400">→ recategorize to</span>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
          >
            <option value="" disabled>
              Pick a category
            </option>
            {categoryOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={applyBulk}
            disabled={bulkBusy || !bulkCategory}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {bulkBusy ? "Applying…" : "Apply"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          {bulkError && (
            <span className="text-xs text-red-400">{bulkError}</span>
          )}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible"
                  className="accent-emerald-500"
                />
              </th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Merchant</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((t) => (
              <tr
                key={t.id}
                className={`${t.pending ? "bg-slate-800/30" : ""} ${
                  selected.has(t.id) ? "bg-emerald-950/30" : ""
                }`}
              >
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    className="accent-emerald-500"
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                  {formatDate(t.date)}
                </td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-100">
                    {t.merchantName ?? t.name}
                  </div>
                  {t.merchantName && t.merchantName !== t.name && (
                    <div className="text-xs text-slate-500">{t.name}</div>
                  )}
                  {t.pending && (
                    <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                      pending
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-400">
                  {t.accountName}
                </td>
                <td className="px-4 py-2 text-slate-300">
                  <CategoryCell
                    transactionId={t.id}
                    merchant={t.merchantKey}
                    merchantTxnCount={t.merchantTxnCount}
                    transactionAmount={t.amount}
                    currentKey={t.categoryKey}
                    currentLabel={t.categoryLabel}
                    options={categoryOptions}
                  />
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-2 text-right font-medium ${
                    t.amount < 0 ? "text-emerald-400" : "text-slate-100"
                  }`}
                >
                  {t.amount < 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(t.amount), t.isoCurrencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
