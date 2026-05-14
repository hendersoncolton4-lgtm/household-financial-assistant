import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { GOAL_TYPE_LABELS, type GoalType } from "@/lib/db/schema";
import {
  computeGoalProgress,
  projectFutureValue,
  yearsToReach,
} from "@/lib/goals";
import { formatCurrency } from "@/lib/format";
import { DeleteGoalButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function GoalDetailPage(props: PageProps<"/goals/[id]">) {
  const { id } = await props.params;
  const goal = db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.id, id))
    .get();
  if (!goal) notFound();

  const progress = computeGoalProgress(goal);
  const accountsList = db.select().from(schema.accounts).all();
  const linked = goal.linkedAccountId
    ? accountsList.find((a) => a.id === goal.linkedAccountId)
    : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {GOAL_TYPE_LABELS[goal.type as GoalType] ?? goal.type}
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">{goal.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/goals"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            ← All goals
          </Link>
          <DeleteGoalButton id={goal.id} />
        </div>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <div className="text-sm text-slate-300">{progress.headline}</div>
        {progress.pct != null && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full ${
                progress.status === "achieved"
                  ? "bg-emerald-400"
                  : progress.status === "behind"
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, progress.pct * 100).toFixed(1)}%` }}
            />
          </div>
        )}
        <div className="mt-3 text-xs text-slate-500">{progress.detail}</div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {goal.targetAmount != null && (
          <Info label="Target" value={
            goal.type === "savings_rate"
              ? `${(goal.targetAmount * 100).toFixed(0)}% of income`
              : formatCurrency(goal.targetAmount)
          } />
        )}
        {goal.targetDate && (
          <Info label="Target date" value={new Date(goal.targetDate).toLocaleDateString()} />
        )}
        {goal.startingAmount != null && (
          <Info label="Starting balance" value={formatCurrency(goal.startingAmount)} />
        )}
        {linked && (
          <Info
            label="Linked account"
            value={`${linked.name}${linked.mask ? ` ••${linked.mask}` : ""}`}
          />
        )}
        {goal.monthlyContribution != null && (
          <Info label="Monthly contribution" value={formatCurrency(goal.monthlyContribution)} />
        )}
        {goal.expectedReturnRate != null && (
          <Info label="Expected return" value={`${(goal.expectedReturnRate * 100).toFixed(1)}% / yr`} />
        )}
      </section>

      {goal.type === "retirement" && <RetirementProjection goal={goal} progress={progress} />}

      {goal.notes && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Notes</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{goal.notes}</p>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function RetirementProjection({
  goal,
  progress,
}: {
  goal: typeof schema.goals.$inferSelect;
  progress: ReturnType<typeof computeGoalProgress>;
}) {
  const current = progress.current ?? 0;
  const target = goal.targetAmount ?? 0;
  const r = goal.expectedReturnRate ?? 0.07;
  const monthly = goal.monthlyContribution ?? 0;
  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  const yearsToTarget = targetDate
    ? Math.max(0, (targetDate.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const milestones = [5, 10, 20, 30].map((y) => ({
    years: y,
    value: projectFutureValue(current, monthly, r, y),
  }));

  const yearsNeeded = target > 0 ? yearsToReach(current, monthly, r, target) : null;
  const fvAtTarget =
    yearsToTarget != null ? projectFutureValue(current, monthly, r, yearsToTarget) : null;
  const shortfall = fvAtTarget != null && target > 0 ? target - fvAtTarget : null;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-slate-100">Projection</h2>
        <p className="mt-1 text-xs text-slate-500">
          Assumes {(r * 100).toFixed(1)}% annual return compounded monthly with{" "}
          {formatCurrency(monthly)} added each month. Real-world returns vary;
          markets can lose money. Talk to a fee-only fiduciary before making
          large allocation decisions.
        </p>
      </header>

      {yearsToTarget != null && fvAtTarget != null && (
        <div
          className={`rounded-lg border p-4 ${
            shortfall != null && shortfall <= 0
              ? "border-emerald-700 bg-emerald-950/40"
              : "border-amber-700 bg-amber-950/30"
          }`}
        >
          <div className="text-sm text-slate-300">
            At your target date ({targetDate?.toLocaleDateString()}, ~
            {yearsToTarget.toFixed(1)} years away), you're projected to have{" "}
            <strong className="text-slate-100">{formatCurrency(fvAtTarget)}</strong>.
          </div>
          {target > 0 && shortfall != null && (
            <div className="mt-1 text-sm text-slate-300">
              {shortfall <= 0
                ? `That's ${formatCurrency(-shortfall)} above your target.`
                : `That's ${formatCurrency(shortfall)} short of your ${formatCurrency(target)} target.`}
            </div>
          )}
        </div>
      )}

      {yearsNeeded != null && target > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          At the current pace, you'd hit {formatCurrency(target)} in roughly{" "}
          <strong className="text-slate-100">{yearsNeeded.toFixed(1)} years</strong>.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Years from now</th>
              <th className="px-4 py-2 text-right">Projected balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {milestones.map((m) => (
              <tr key={m.years}>
                <td className="px-4 py-2 text-slate-300">{m.years} years</td>
                <td className="px-4 py-2 text-right font-medium text-slate-100">
                  {formatCurrency(m.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
