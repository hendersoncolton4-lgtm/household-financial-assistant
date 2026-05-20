"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RemoveManualButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/manual/${id}`, { method: "DELETE" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={remove}
          disabled={busy || pending}
          className="rounded-md bg-rose-500 px-2 py-1 text-xs font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50"
          title={`Delete ${name}`}
        >
          Delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
    >
      Remove
    </button>
  );
}
