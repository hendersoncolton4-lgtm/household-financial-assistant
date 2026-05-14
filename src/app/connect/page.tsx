"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import Link from "next/link";

export default function ConnectPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to create link token");
          return;
        }
        setLinkToken(data.link_token);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Network error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setBusy(true);
    setError(null);
    setStatus("Linking account…");
    try {
      const res = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Exchange failed");
        setStatus(null);
        return;
      }
      setStatus(
        `Connected ${data.institutionName ?? "bank"} with ${data.accounts} account(s). Syncing transactions…`
      );

      const syncRes = await fetch("/api/plaid/sync", { method: "POST" });
      const syncData = await syncRes.json();
      if (!syncRes.ok) {
        setError(syncData.error ?? "Sync failed");
        return;
      }
      setStatus(
        `Done. Added ${syncData.added} transactions. You can view them on the Accounts and Transactions pages.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Connect an account</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Use Plaid to securely link a bank, credit card, or brokerage. In
          sandbox mode you can pick any bank and log in with{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">user_good</code>{" "}
          /{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">pass_good</code>{" "}
          to load fake test data.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => open()}
            disabled={!ready || !linkToken || busy}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
          >
            {linkToken ? "Open Plaid Link" : "Loading…"}
          </button>
          <Link
            href="/accounts"
            className="text-sm font-medium text-slate-400 hover:text-slate-100"
          >
            View linked accounts →
          </Link>
        </div>

        {status && (
          <div className="mt-4 rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {status}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
        <h2 className="text-base font-semibold text-slate-100">What happens when you connect</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5">
          <li>Plaid opens a secure popup with your bank's login.</li>
          <li>Your bank gives Plaid a token — your password never touches this app.</li>
          <li>We exchange that for an access token, encrypt it, and store it locally in <code className="rounded bg-slate-800 px-1 text-slate-200">data/app.db</code>.</li>
          <li>We pull your accounts and recent transactions and store them locally too.</li>
          <li>Hit "Sync" anytime to pull the latest changes.</li>
        </ol>
      </section>
    </div>
  );
}
