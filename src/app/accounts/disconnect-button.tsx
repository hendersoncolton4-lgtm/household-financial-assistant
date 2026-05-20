"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DisconnectButton({
  itemId,
  institutionName,
}: {
  itemId: string;
  institutionName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plaid/items/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Disconnect failed");
        setBusy(false);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="text-xs text-slate-300">
          Disconnect {institutionName}? Removes all accounts and transactions
          from this app and revokes the Plaid token.
        </div>
        <div className="flex gap-2">
          <button
            onClick={disconnect}
            disabled={busy || pending}
            className="rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-rose-400 disabled:opacity-50"
          >
            {busy || pending ? "Removing…" : "Yes, disconnect"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400 hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
    >
      Disconnect
    </button>
  );
}
