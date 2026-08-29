"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

type ItemStatus = {
  id: string;
  institutionName: string | null;
  hasError: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  needsReauth: boolean;
};

/**
 * Banner that shows which Plaid institutions are broken and lets the user
 * re-authorize each one with a single click. Uses Plaid Link "update mode"
 * — no new item is created; the existing access_token is repaired.
 */
export function PlaidStatusBanner() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<ItemStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/status");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Status check failed");
        return;
      }
      setStatuses(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSuccess = useCallback(async () => {
    setBusy(true);
    setFlash("Re-authorized. Syncing…");
    try {
      // Item is repaired on Plaid's side the moment Link closes with success.
      // Kick off a sync to pull any transactions we missed while it was broken.
      const syncRes = await fetch("/api/plaid/sync", { method: "POST" });
      const syncData = await syncRes.json();
      if (syncRes.ok) {
        setFlash(
          `Re-authorized. Added ${syncData.added} transaction${syncData.added === 1 ? "" : "s"}.`
        );
      } else {
        setFlash("Re-authorized, but sync errored — try Sync now.");
      }
      await load();
      router.refresh();
    } finally {
      setBusy(false);
      setActiveItemId(null);
      setLinkToken(null);
    }
  }, [load, router]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {
      setActiveItemId(null);
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  async function startReauth(itemId: string) {
    setActiveItemId(itemId);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/update-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start re-auth");
        setActiveItemId(null);
        return;
      }
      setLinkToken(data.link_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setActiveItemId(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;

  const broken = (statuses ?? []).filter((s) => s.needsReauth || s.hasError);

  if (broken.length === 0) {
    if (flash) {
      return (
        <section className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-200">
          {flash}
        </section>
      );
    }
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-700 bg-amber-950/30 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            {broken.length === 1
              ? "1 institution needs to be re-authorized"
              : `${broken.length} institutions need to be re-authorized`}
          </h2>
          <p className="mt-0.5 text-xs text-amber-200/80">
            Banks periodically invalidate their Plaid session (password
            changes, MFA policy updates, or just Plaid's own consent
            refreshes). Click Re-authorize below — it opens the same secure
            Plaid login flow as when you first connected. No data is lost.
          </p>
        </div>
      </header>

      <ul className="mt-3 space-y-2">
        {broken.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-semibold text-amber-100">
                {s.institutionName ?? "Unknown institution"}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-amber-300/70">
                {s.errorCode ?? "error"}
              </div>
              {s.errorMessage && (
                <div className="mt-0.5 text-xs text-amber-200/80">
                  {s.errorMessage}
                </div>
              )}
            </div>
            <button
              onClick={() => startReauth(s.id)}
              disabled={busy && activeItemId !== s.id}
              className="rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {activeItemId === s.id
                ? busy
                  ? "Opening Plaid…"
                  : "Re-authorizing…"
                : "Re-authorize"}
            </button>
          </li>
        ))}
      </ul>

      {flash && (
        <div className="mt-3 rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {flash}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </section>
  );
}
