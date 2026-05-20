"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { key: string; label: string };

export function CategoryCell({
  transactionId,
  merchant,
  merchantTxnCount,
  transactionAmount,
  currentKey,
  currentLabel,
  options,
}: {
  transactionId: string;
  merchant: string;
  merchantTxnCount: number;
  transactionAmount: number;
  currentKey: string | null;
  currentLabel: string;
  options: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(currentKey ?? "");
  const [applyToMerchant, setApplyToMerchant] = useState(merchantTxnCount > 1);
  const [showRange, setShowRange] = useState(false);
  const [useMin, setUseMin] = useState(false);
  const [useMax, setUseMax] = useState(false);
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");

  // Inline new category
  const [creatingNew, setCreatingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [creatingBusy, setCreatingBusy] = useState(false);

  const [localOptions, setLocalOptions] = useState<Option[]>(options);
  useEffect(() => setLocalOptions(options), [options]);

  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function createCategory() {
    const label = newLabel.trim();
    if (!label) return;
    setCreatingBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create category");
        return;
      }
      // Optimistically add to options + select it
      const next = [...localOptions, { key: data.key, label }];
      next.sort((a, b) => a.label.localeCompare(b.label));
      setLocalOptions(next);
      setSelected(data.key);
      setCreatingNew(false);
      setNewLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setCreatingBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    if (selected === currentKey && !applyToMerchant) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        categoryKey: selected,
        applyToMerchant: applyToMerchant && merchantTxnCount > 1,
      };
      if (applyToMerchant && useMin) {
        const n = parseFloat(minStr);
        if (Number.isFinite(n)) body.amountMin = n;
      }
      if (applyToMerchant && useMax) {
        const n = parseFloat(maxStr);
        if (Number.isFinite(n)) body.amountMax = n;
      }
      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-transparent px-2 py-0.5 text-left text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200"
        title="Click to change category"
      >
        {currentLabel}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-slate-700 bg-slate-900 p-3 shadow-lg">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Change category
          </div>

          {creatingNew ? (
            <div className="mt-2 space-y-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="New category name…"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") createCategory();
                  if (e.key === "Escape") {
                    setCreatingNew(false);
                    setNewLabel("");
                  }
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={createCategory}
                  disabled={creatingBusy || !newLabel.trim()}
                  className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
                >
                  {creatingBusy ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => {
                    setCreatingNew(false);
                    setNewLabel("");
                  }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              >
                <option value="" disabled>
                  Pick a category
                </option>
                {localOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCreatingNew(true)}
                className="mt-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                + Create new category
              </button>
            </>
          )}

          {!creatingNew && merchantTxnCount > 1 && (
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={applyToMerchant}
                  onChange={(e) => {
                    setApplyToMerchant(e.target.checked);
                    if (!e.target.checked) setShowRange(false);
                  }}
                  className="mt-0.5 accent-emerald-500"
                />
                <span>
                  Apply to all <strong className="text-slate-100">{merchantTxnCount}</strong>{" "}
                  transactions from <strong className="text-slate-100">{merchant}</strong>{" "}
                  (and remember for future syncs)
                </span>
              </label>
              {applyToMerchant && (
                <div className="ml-5 space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowRange((v) => !v)}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-200"
                  >
                    {showRange ? "− Hide amount range" : "+ Only apply when amount…"}
                  </button>
                  {showRange && (
                    <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-950/60 p-2">
                      <label className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={useMin}
                          onChange={(e) => setUseMin(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>is at least</span>
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={minStr}
                          onChange={(e) => setMinStr(e.target.value)}
                          disabled={!useMin}
                          placeholder="20"
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-100 disabled:opacity-50"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-slate-300">
                        <input
                          type="checkbox"
                          checked={useMax}
                          onChange={(e) => setUseMax(e.target.checked)}
                          className="accent-emerald-500"
                        />
                        <span>is less than</span>
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={maxStr}
                          onChange={(e) => setMaxStr(e.target.value)}
                          disabled={!useMax}
                          placeholder="20"
                          className="w-20 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-100 disabled:opacity-50"
                        />
                      </label>
                      <p className="pt-1 text-[10px] text-slate-500">
                        This transaction is ${Math.abs(transactionAmount).toFixed(2)}.
                        You can add a separate rule for the other range later.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <div className="mt-2 text-xs text-red-400">{error}</div>}

          {!creatingNew && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={save}
                disabled={busy || pending || !selected}
                className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
              >
                {busy || pending ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
