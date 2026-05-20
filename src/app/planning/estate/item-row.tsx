"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EstateStatus } from "@/lib/db/schema";

type Item = {
  id: string;
  title: string;
  categoryLabel: string;
  forPersonLabel: string | null;
  status: EstateStatus;
  lastReviewed: string | null;
  notes: string | null;
};

export function EstateItemRow({
  item,
  statusLabels,
}: {
  item: Item;
  statusLabels: Record<EstateStatus, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [lastReviewed, setLastReviewed] = useState(item.lastReviewed ?? "");

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/estate/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveDetails() {
    await patch({ notes, lastReviewed: lastReviewed || null });
    setEditing(false);
  }

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-slate-100">
            {item.title}
            {item.forPersonLabel && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                {item.forPersonLabel}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
            {item.categoryLabel}
            {item.lastReviewed && (
              <span className="ml-2 normal-case">
                · last reviewed {new Date(item.lastReviewed).toLocaleDateString()}
              </span>
            )}
          </div>
          {item.notes && !editing && (
            <div className="mt-1 text-xs italic text-slate-500">{item.notes}</div>
          )}
          {editing && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wide text-slate-500">
                  Last reviewed
                </label>
                <input
                  type="date"
                  value={lastReviewed}
                  onChange={(e) => setLastReviewed(e.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                />
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes (where it's stored, who has copies, attorney name…)"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveDetails}
                  disabled={busy}
                  className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={item.status}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={busy || pending}
            className={`rounded-md border px-2 py-1 text-xs ${statusBadgeCls(item.status)}`}
          >
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k} className="bg-slate-950">
                {v}
              </option>
            ))}
          </select>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function statusBadgeCls(s: EstateStatus): string {
  switch (s) {
    case "complete":
      return "border-emerald-700 bg-emerald-950/40 text-emerald-300";
    case "in_progress":
      return "border-amber-700 bg-amber-950/30 text-amber-300";
    case "not_applicable":
      return "border-slate-700 bg-slate-900 text-slate-400";
    default:
      return "border-rose-700 bg-rose-950/30 text-rose-300";
  }
}
