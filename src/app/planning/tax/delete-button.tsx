"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteContributionButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm("Delete this contribution record?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tax-contributions/${id}`, { method: "DELETE" });
      if (res.ok) {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy || pending}
      className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300 disabled:opacity-50"
    >
      Delete
    </button>
  );
}
