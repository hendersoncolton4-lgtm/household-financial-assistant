import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
} from "@/lib/db/schema";
import { formatCurrency } from "@/lib/format";
import { getAccount, type AccountInfo } from "@/lib/alpaca";
import { ProposalCard } from "./proposal-card";
import { GenerateProposalButton } from "./generate-button";
import { SyncOrdersButton } from "./sync-button";

export const dynamic = "force-dynamic";

export default async function TradingPage() {
  const allProposals = db
    .select()
    .from(schema.proposals)
    .orderBy(desc(schema.proposals.createdAt))
    .all();

  const pending = allProposals.filter((p) => p.status === "pending");
  const approved = allProposals.filter((p) => p.status === "approved");
  const history = allProposals.filter(
    (p) =>
      p.status === "executed" ||
      p.status === "rejected" ||
      p.status === "cancelled" ||
      p.status === "failed"
  );

  let account: AccountInfo | null = null;
  let accountError: string | null = null;
  try {
    account = await getAccount();
  } catch (e) {
    accountError = e instanceof Error ? e.message : "Failed to load account";
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-100">Trading</h1>
            {account?.isPaper && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                Paper
              </span>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            AI-proposed paper trades you approve before they execute. Fake
            money for now — Phase 6. Real money is a separate explicit decision
            (Phase 8) and not enabled here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {approved.length > 0 && <SyncOrdersButton />}
          <GenerateProposalButton />
        </div>
      </header>

      {accountError && (
        <section className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          Couldn't load Alpaca account: <code className="text-amber-100">{accountError}</code>
        </section>
      )}

      {account && (
        <section className="grid gap-3 sm:grid-cols-4">
          <Stat label="Buying power" value={formatCurrency(account.buyingPower)} accent />
          <Stat label="Cash" value={formatCurrency(account.cash)} />
          <Stat label="Portfolio value" value={formatCurrency(account.portfolioValue)} />
          <Stat
            label="Day P/L"
            value={(() => {
              const pl = account.equity - account.lastEquity;
              return `${pl >= 0 ? "+" : ""}${formatCurrency(pl)}`;
            })()}
            positive={account.equity - account.lastEquity > 0}
            negative={account.equity - account.lastEquity < 0}
          />
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100">
            Pending approval ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={proposalToCard(p)}
              />
            ))}
          </div>
        </section>
      )}

      {approved.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100">
            Approved — awaiting fill ({approved.length})
          </h2>
          <div className="space-y-3">
            {approved.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={proposalToCard(p)}
              />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && approved.length === 0 && (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            No proposals in the queue. Hit{" "}
            <strong className="text-slate-200">"Generate proposal"</strong> above and
            the agent will pick something from your watchlist or holdings to
            propose. Or click <strong className="text-slate-200">"Propose trade"</strong> on
            any symbol's research page.
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-100">
            History ({history.length})
          </h2>
          <div className="space-y-2">
            {history.slice(0, 50).map((p) => (
              <HistoryRow key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function proposalToCard(p: typeof schema.proposals.$inferSelect) {
  return {
    id: p.id,
    symbol: p.symbol,
    side: p.side,
    orderType: p.orderType,
    quantity: p.quantity,
    limitPrice: p.limitPrice,
    estimatedValue: p.estimatedValue,
    rationale: p.rationale,
    riskNotes: p.riskNotes,
    status: p.status as ProposalStatus,
    alpacaOrderStatus: p.alpacaOrderStatus,
    createdAt: p.createdAt,
  };
}

function HistoryRow({
  proposal,
}: {
  proposal: typeof schema.proposals.$inferSelect;
}) {
  const p = proposal;
  const ok = p.status === "executed";
  const badge =
    p.status === "executed"
      ? "bg-emerald-500/20 text-emerald-300"
      : p.status === "rejected" || p.status === "cancelled"
      ? "bg-slate-700 text-slate-300"
      : "bg-rose-500/20 text-rose-300";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge}`}
        >
          {PROPOSAL_STATUS_LABELS[p.status as ProposalStatus] ?? p.status}
        </span>
        <span className="font-semibold text-slate-100">
          {p.side.toUpperCase()} {p.quantity} {p.symbol}
        </span>
        <span className="text-xs text-slate-500">
          {p.orderType}{p.limitPrice ? ` @ $${p.limitPrice.toFixed(2)}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        {ok && p.filledPrice != null && (
          <span className="text-emerald-300">
            Filled @ ${p.filledPrice.toFixed(2)} ({formatCurrency(p.filledPrice * (p.filledQuantity ?? p.quantity))})
          </span>
        )}
        <span>{new Date(p.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  positive,
  negative,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-emerald-700 bg-emerald-950/40"
          : positive
          ? "border-emerald-700/60 bg-emerald-950/20"
          : negative
          ? "border-rose-700/60 bg-rose-950/20"
          : "border-slate-800 bg-slate-900"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold tracking-tight ${
          accent
            ? "text-emerald-300"
            : positive
            ? "text-emerald-300"
            : negative
            ? "text-rose-300"
            : "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
