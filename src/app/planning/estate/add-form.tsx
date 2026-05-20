"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ESTATE_CATEGORY_LABELS } from "@/lib/db/schema";

export function AddEstateItemForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      title: String(fd.get("title") ?? ""),
      category: String(fd.get("category") ?? "other"),
      forPerson: String(fd.get("forPerson") ?? "") || null,
    };
    if (!body.title.trim()) {
      setError("Title is required");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/estate", {
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
      className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4"
    >
      <h3 className="col-span-full text-sm font-semibold text-slate-100">
        Add a custom item
      </h3>
      <label className="block sm:col-span-2">
        <span className={labelCls}>Title</span>
        <input
          name="title"
          required
          placeholder="e.g. Digital asset access list"
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className={labelCls}>Category</span>
        <select name="category" defaultValue="other" className={inputCls}>
          {Object.entries(ESTATE_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>For</span>
        <select name="forPerson" defaultValue="household" className={inputCls}>
          <option value="household">Household</option>
          <option value="primary">Primary</option>
          <option value="secondary">Spouse</option>
        </select>
      </label>
      <div className="sm:col-span-4 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Adding…" : "Add item"}
        </button>
      </div>
      {error && (
        <div className="sm:col-span-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none";
const labelCls = "block text-[10px] uppercase tracking-wide text-slate-500";
