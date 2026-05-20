import Link from "next/link";
import { db, schema } from "@/lib/db";
import { formatCurrency, titleCase } from "@/lib/format";
import { SyncButton } from "./sync-button";
import { DisconnectButton } from "./disconnect-button";
import { RemoveManualButton } from "./remove-manual-button";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const items = db.select().from(schema.plaidItems).all();
  const allAccounts = db.select().from(schema.accounts).all();
  const plaidAccounts = allAccounts.filter((a) => a.source === "plaid");
  const manualAccounts = allAccounts.filter((a) => a.source === "manual");

  let assets = 0;
  let liabilities = 0;
  for (const a of allAccounts) {
    if (a.currentBalance == null) continue;
    if (a.type === "depository" || a.type === "investment") {
      assets += a.currentBalance;
    } else if (a.type === "credit" || a.type === "loan") {
      liabilities += a.currentBalance;
    }
  }
  const netWorth = assets - liabilities;
  const hasAnything = allAccounts.length > 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Accounts</h1>
          <p className="mt-1 text-sm text-slate-400">
            {!hasAnything
              ? "No accounts yet — connect via Plaid or add a manual entry."
              : `${allAccounts.length} account(s) total · ${items.length} via Plaid · ${manualAccounts.length} manual.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/connect"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            + Connect via Plaid
          </Link>
          <Link
            href="/accounts/manual/new"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            + Add manual entry
          </Link>
          {items.length > 0 && <SyncButton />}
        </div>
      </section>

      {hasAnything && (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Net worth" value={formatCurrency(netWorth)} accent />
          <Stat label="Total assets" value={formatCurrency(assets)} />
          <Stat label="Total liabilities" value={formatCurrency(liabilities)} />
        </section>
      )}

      {items.map((item) => {
        const itemAccounts = plaidAccounts.filter((a) => a.itemId === item.id);
        return (
          <section key={item.id} className="rounded-lg border border-slate-800 bg-slate-900">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  {item.institutionName ?? "Unknown institution"}
                </h2>
                <p className="text-xs text-slate-500">
                  Connected {new Date(item.createdAt).toLocaleDateString()} · via Plaid
                </p>
              </div>
              <DisconnectButton
                itemId={item.id}
                institutionName={item.institutionName ?? "this institution"}
              />
            </header>
            <ul className="divide-y divide-slate-800">
              {itemAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {a.name}
                      {a.mask && (
                        <span className="ml-2 text-xs text-slate-500">••{a.mask}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {titleCase(a.subtype ?? a.type)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold ${
                        a.type === "credit" || a.type === "loan"
                          ? "text-rose-400"
                          : "text-slate-100"
                      }`}
                    >
                      {formatCurrency(a.currentBalance, a.isoCurrencyCode)}
                    </div>
                    {a.availableBalance !== null &&
                      a.availableBalance !== a.currentBalance && (
                        <div className="text-xs text-slate-500">
                          {formatCurrency(a.availableBalance, a.isoCurrencyCode)} available
                        </div>
                      )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {manualAccounts.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Manual entries</h2>
              <p className="text-xs text-slate-500">
                Accounts you maintain by hand — balances don't auto-update.
              </p>
            </div>
            <Link
              href="/accounts/manual/new"
              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-800"
            >
              + Add another
            </Link>
          </header>
          <ul className="divide-y divide-slate-800">
            {manualAccounts.map((a) => {
              const isLiability = a.type === "credit" || a.type === "loan";
              return (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-100">{a.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {titleCase(a.subtype ?? a.type)}
                        {a.lenderName && ` · ${a.lenderName}`}
                      </div>
                      {(a.interestRate != null || a.monthlyPayment != null || a.originalPrincipal != null) && (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                          {a.interestRate != null && (
                            <span>{(a.interestRate * 100).toFixed(2)}% APR</span>
                          )}
                          {a.monthlyPayment != null && (
                            <span>{formatCurrency(a.monthlyPayment)} / mo</span>
                          )}
                          {a.originalPrincipal != null && a.currentBalance != null && (
                            <span>
                              {formatCurrency(a.originalPrincipal - a.currentBalance)} paid down of{" "}
                              {formatCurrency(a.originalPrincipal)}
                            </span>
                          )}
                        </div>
                      )}
                      {a.notes && (
                        <div className="mt-1 text-xs italic text-slate-500">{a.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`text-right text-sm font-semibold ${
                          isLiability ? "text-rose-400" : "text-slate-100"
                        }`}
                      >
                        {formatCurrency(a.currentBalance, a.isoCurrencyCode)}
                      </div>
                      <RemoveManualButton id={a.id} name={a.name} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!hasAnything && (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            Connect an account to start tracking automatically, or add a manual
            entry for things Plaid can't reach (most mortgages and auto loans).
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link
              href="/connect"
              className="inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Connect via Plaid →
            </Link>
            <Link
              href="/accounts/manual/new"
              className="inline-flex rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Add manual entry →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? "border-emerald-700 bg-emerald-950/40" : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent ? "text-emerald-300" : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
