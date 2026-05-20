"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncOrdersButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setInfo(null);
    try {
      const res = await fetch("/api/proposals/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setInfo(`Checked ${data.checked}, reconciled ${data.reconciled}`);
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={sync}
        disabled={busy || pending}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
      >
        {busy || pending ? "Syncing…" : "Sync orders"}
      </button>
      {info && <div className="text-xs text-slate-400">{info}</div>}
    </div>
  );
}
