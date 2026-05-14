import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeGoalProgress } from "@/lib/goals";

export const dynamic = "force-dynamic";

const phases = [
  { num: 0, name: "Foundation", desc: "App scaffold + AI chat", status: "done" },
  { num: 1, name: "Financial picture", desc: "Connect banks/cards/brokerages via Plaid", status: "done" },
  { num: 2, name: "Goals & projections", desc: "Targets, progress, monthly reviews", status: "current" },
  { num: 3, name: "Opportunity scanner", desc: "Background agent surfaces savings & income gaps", status: "next" },
  { num: 4, name: "Tax / insurance / estate helper", desc: "Headroom, gaps, document checklist", status: "later" },
  { num: 5, name: "Market research agent", desc: "Watchlist + theses (no trading)", status: "later" },
  { num: 6, name: "Paper trading + approval queue", desc: "Agent proposes, you approve, executes on paper", status: "later" },
  { num: 7, name: "Multi-user + deploy", desc: "Wife joins, runs on a real URL, PWA on iPhone", status: "later" },
];

export default function Home() {
  const accountsList = db.select().from(schema.accounts).all();
  const items = db.select().from(schema.plaidItems).all();
  const recentTxns = db
    .select()
    .from(schema.transactions)
    .orderBy(desc(schema.transactions.date))
    .limit(5)
    .all();
  const goalsList = db.select().from(schema.goals).all();
  const activeGoals = goalsList.filter((g) => !g.archived);
  const accountMap = new Map(accountsList.map((a) => [a.id, a]));

  let assets = 0;
  let liabilities = 0;
  for (const a of accountsList) {
    if (a.currentBalance == null) continue;
    if (a.type === "depository" || a.type === "investment") {
      assets += a.currentBalance;
    } else if (a.type === "credit" || a.type === "loan") {
      liabilities += a.currentBalance;
    }
  }
  const netWorth = assets - liabilities;
  const hasData = accountsList.length > 0;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          {hasData ? "Welcome back" : "Welcome to your household financial assistant"}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          {hasData
            ? "Here's your current snapshot. The chat agent has live context to all of this."
            : "A private, AI-powered overview of your finances — accounts, goals, taxes, insurance, and investments. Connect your first account to get started."}
        </p>
        <div className="mt-6 flex gap-3">
          {hasData ? (
            <Link
              href="/chat"
              className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Ask your assistant →
            </Link>
          ) : (
            <Link
              href="/connect"
              className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Connect your first account →
            </Link>
          )}
        </div>
      </section>

      {hasData && (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label="Net worth" value={formatCurrency(netWorth)} accent />
            <Stat label="Assets" value={formatCurrency(assets)} />
            <Stat label="Liabilities" value={formatCurrency(liabilities)} />
          </section>

          {activeGoals.length > 0 && (
            <section className="rounded-lg border border-slate-800 bg-slate-900">
              <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-100">Goal progress</h2>
                <Link
                  href="/goals"
                  className="text-xs font-medium text-slate-400 hover:text-slate-100"
                >
                  View all →
                </Link>
              </header>
              <ul className="divide-y divide-slate-800">
                {activeGoals.slice(0, 4).map((g) => {
                  const p = computeGoalProgress(g);
                  const pct = p.pct == null ? null : Math.max(0, Math.min(1, p.pct));
                  return (
                    <li key={g.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Link
                          href={`/goals/${g.id}`}
                          className="text-sm font-medium text-slate-100 hover:underline"
                        >
                          {g.name}
                        </Link>
                        <div className="text-xs text-slate-400">{p.headline}</div>
                      </div>
                      {pct != null && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full ${
                              p.status === "achieved"
                                ? "bg-emerald-400"
                                : p.status === "behind"
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, pct * 100).toFixed(1)}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900">
              <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-100">Accounts</h2>
                <Link
                  href="/accounts"
                  className="text-xs font-medium text-slate-400 hover:text-slate-100"
                >
                  View all →
                </Link>
              </header>
              <ul className="divide-y divide-slate-800">
                {accountsList.slice(0, 6).map((a) => {
                  const inst = items.find((i) => i.id === a.itemId);
                  return (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-100">{a.name}</div>
                        <div className="text-xs text-slate-500">
                          {inst?.institutionName ?? "Unknown"} · {a.mask ? `••${a.mask}` : a.subtype ?? a.type}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          a.type === "credit" || a.type === "loan"
                            ? "text-rose-400"
                            : "text-slate-100"
                        }`}
                      >
                        {formatCurrency(a.currentBalance, a.isoCurrencyCode)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900">
              <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-100">Recent transactions</h2>
                <Link
                  href="/transactions"
                  className="text-xs font-medium text-slate-400 hover:text-slate-100"
                >
                  View all →
                </Link>
              </header>
              <ul className="divide-y divide-slate-800">
                {recentTxns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="truncate text-sm font-medium text-slate-100">
                        {t.merchantName ?? t.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(t.date)} · {accountMap.get(t.accountId)?.name ?? "—"}
                      </div>
                    </div>
                    <div
                      className={`whitespace-nowrap text-sm font-medium ${
                        t.amount < 0 ? "text-emerald-400" : "text-slate-100"
                      }`}
                    >
                      {t.amount < 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(t.amount), t.isoCurrencyCode)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">Build roadmap</h2>
        <p className="mt-1 text-sm text-slate-400">
          We build one phase at a time. Each phase is useful on its own.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {phases.map((p) => (
            <li
              key={p.num}
              className={`rounded-lg border p-4 ${
                p.status === "current"
                  ? "border-emerald-700 bg-emerald-950/40"
                  : "border-slate-800 bg-slate-900"
              } ${p.status === "done" ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phase {p.num}
                </span>
                {p.status === "current" && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    In progress
                  </span>
                )}
                {p.status === "done" && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    Done
                  </span>
                )}
                {p.status === "next" && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    Up next
                  </span>
                )}
              </div>
              <div className="mt-1 font-medium text-slate-100">{p.name}</div>
              <div className="text-sm text-slate-400">{p.desc}</div>
            </li>
          ))}
        </ul>
      </section>
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
