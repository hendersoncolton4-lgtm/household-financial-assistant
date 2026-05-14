import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { GOAL_TYPE_LABELS, type GoalType } from "@/lib/db/schema";
import { computeGoalProgress } from "@/lib/goals";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function GoalsPage() {
  const goalsList = db
    .select()
    .from(schema.goals)
    .orderBy(desc(schema.goals.createdAt))
    .all();
  const active = goalsList.filter((g) => !g.archived);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Goals</h1>
          <p className="mt-1 text-sm text-slate-400">
            {active.length === 0
              ? "No goals yet. Set 1–3 to start — small targets work better than big vague ones."
              : `${active.length} active goal(s).`}
          </p>
        </div>
        <Link
          href="/goals/new"
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          + New goal
        </Link>
      </section>

      {active.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10">
          <h2 className="text-base font-semibold text-slate-100">Suggested starter goals</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
            <li><strong className="text-slate-200">Emergency fund</strong> — 3–6 months of expenses in a high-yield savings account.</li>
            <li><strong className="text-slate-200">Highest-rate debt</strong> — target a $0 balance on your highest-APR credit card or loan.</li>
            <li><strong className="text-slate-200">Retirement</strong> — a long-horizon target with monthly contributions; we'll project growth.</li>
            <li><strong className="text-slate-200">Savings rate</strong> — aim for 15–25% of income saved monthly (rule of thumb, not gospel).</li>
          </ul>
        </section>
      ) : (
        <ul className="grid gap-3">
          {active.map((g) => {
            const p = computeGoalProgress(g);
            const pct = p.pct == null ? null : Math.max(0, Math.min(1, p.pct));
            return (
              <li key={g.id}>
                <Link
                  href={`/goals/${g.id}`}
                  className="block rounded-lg border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 hover:bg-slate-900/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {GOAL_TYPE_LABELS[g.type as GoalType] ?? g.type}
                      </div>
                      <div className="mt-0.5 text-base font-semibold text-slate-100">{g.name}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-3 text-sm text-slate-300">{p.headline}</div>
                  {pct != null && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
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
                  {g.targetDate && (
                    <div className="mt-2 text-xs text-slate-500">
                      Target by {new Date(g.targetDate).toLocaleDateString()}
                      {g.targetAmount != null && ` · ${formatCurrency(g.targetAmount)} target`}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    achieved: { label: "Achieved", cls: "bg-emerald-500/20 text-emerald-300" },
    on_track: { label: "On track", cls: "bg-emerald-500/20 text-emerald-300" },
    ahead: { label: "Ahead", cls: "bg-sky-500/20 text-sky-300" },
    behind: { label: "Behind", cls: "bg-amber-500/20 text-amber-300" },
    unknown: { label: "—", cls: "bg-slate-700 text-slate-300" },
  };
  const { label, cls } = map[status] ?? map.unknown;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
