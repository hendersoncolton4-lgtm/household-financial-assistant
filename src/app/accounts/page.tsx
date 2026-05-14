import Link from "next/link";
import { db, schema } from "@/lib/db";
import { formatCurrency, titleCase } from "@/lib/format";
import { SyncButton } from "./sync-button";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const items = db.select().from(schema.plaidItems).all();
  const allAccounts = db.select().from(schema.accounts).all();

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

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Accounts</h1>
          <p className="mt-1 text-sm text-slate-400">
            {items.length === 0
              ? "No accounts connected yet."
              : `${allAccounts.length} account(s) across ${items.length} institution(s).`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/connect"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800"
          >
            + Connect account
          </Link>
          {items.length > 0 && <SyncButton />}
        </div>
      </section>

      {items.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Net worth" value={formatCurrency(netWorth)} accent />
          <Stat label="Total assets" value={formatCurrency(assets)} />
          <Stat label="Total liabilities" value={formatCurrency(liabilities)} />
        </section>
      )}

      {items.map((item) => {
        const itemAccounts = allAccounts.filter((a) => a.itemId === item.id);
        return (
          <section key={item.id} className="rounded-lg border border-slate-800 bg-slate-900">
            <header className="border-b border-slate-800 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-100">
                {item.institutionName ?? "Unknown institution"}
              </h2>
              <p className="text-xs text-slate-500">
                Connected {new Date(item.createdAt).toLocaleDateString()}
              </p>
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

      {items.length === 0 && (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            Connect your first account to see balances, transactions, and
            net worth here.
          </p>
          <Link
            href="/connect"
            className="mt-4 inline-flex rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Connect an account →
          </Link>
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
