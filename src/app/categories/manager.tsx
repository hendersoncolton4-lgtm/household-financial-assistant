"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type CategoryRow = {
  key: string;
  label: string;
  isCustom: boolean;
  archived: boolean;
  txnCount: number;
  ruleCount: number;
};

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [showArchived, setShowArchived] = useState(false);
  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);
  const visible = showArchived ? categories : active;

  return (
    <div className="space-y-6">
      <AddCategory />

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {showArchived ? "All categories" : "Active categories"}
            </h2>
            <p className="text-xs text-slate-500">
              {active.length} active{archived.length > 0 ? ` · ${archived.length} archived` : ""}
            </p>
          </div>
          {archived.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-emerald-500"
              />
              Show archived
            </label>
          )}
        </header>
        <ul className="divide-y divide-slate-800">
          {visible.map((c) => (
            <CategoryRowEditor key={c.key} cat={c} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function AddCategory() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setLabel("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
    >
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add a custom category
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. House repairs, Tithe, Dog stuff…"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={busy || pending || !label.trim()}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Adding…" : "Add"}
      </button>
      {error && (
        <div className="w-full rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}

function CategoryRowEditor({ cat }: { cat: CategoryRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cat.label);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function patch(updates: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(cat.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLabel() {
    if (!label.trim() || label.trim() === cat.label) {
      setEditing(false);
      setLabel(cat.label);
      return;
    }
    const ok = await patch({ label: label.trim() });
    if (ok) setEditing(false);
  }

  async function toggleArchive() {
    await patch({ archived: !cat.archived });
  }

  async function hardDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(cat.key)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <li className={`px-5 py-3 ${cat.archived ? "opacity-50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveLabel();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setLabel(cat.label);
                  }
                }}
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
              <button
                onClick={saveLabel}
                disabled={busy}
                className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setLabel(cat.label);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-left"
              title="Click to rename"
            >
              <div className="text-sm font-medium text-slate-100 hover:underline">
                {cat.label}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {cat.isCustom ? "Custom" : "Plaid"} · {cat.txnCount} txn
                {cat.ruleCount > 0 && ` · ${cat.ruleCount} merchant rule(s)`}
                {cat.archived && " · archived"}
              </div>
            </button>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {confirmDelete ? (
              <>
                <button
                  onClick={hardDelete}
                  disabled={busy || pending}
                  className="rounded-md bg-rose-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleArchive}
                  disabled={busy || pending}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {cat.archived ? "Unarchive" : "Archive"}
                </button>
                {cat.isCustom && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy || pending}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
                    title="Delete (custom categories only, and only if no transactions reference them)"
                  >
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="mt-2 text-xs text-red-400">{error}</div>
      )}
    </li>
  );
}
