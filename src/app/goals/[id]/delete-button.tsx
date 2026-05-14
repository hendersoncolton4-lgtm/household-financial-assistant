"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteGoalButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/goals");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onDelete}
          disabled={busy}
          className="rounded-md bg-rose-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-950/60"
    >
      Delete
    </button>
  );
}
