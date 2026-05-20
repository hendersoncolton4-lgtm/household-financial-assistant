import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  HOUSEHOLD_PROFILE_ID,
  computeHeadroom,
} from "@/lib/planning";
import { TAX_ACCOUNT_LABELS, type TaxAccountType } from "@/lib/db/schema";
import { formatCurrency } from "@/lib/format";
import { TaxContributionForm } from "./form";
import { DeleteContributionButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default function TaxPage() {
  const profile = db
    .select()
    .from(schema.profile)
    .where(eq(schema.profile.id, HOUSEHOLD_PROFILE_ID))
    .get() ?? null;

  const contributions = db
    .select()
    .from(schema.taxContributions)
    .orderBy(desc(schema.taxContributions.year))
    .all();

  const currentYear = new Date().getFullYear();
  const { byAccount, iraCombined, notes } = computeHeadroom(
    profile,
    contributions,
    currentYear
  );

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/planning" className="hover:text-slate-300">
            ← Planning
          </Link>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-100">
          Tax-advantaged accounts
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          {currentYear} IRS limits and your headroom. Catch-up contributions
          apply at age 50 (401k/IRA) or 55 (HSA). Limits update annually —
          we use 2026 estimates and you can verify against irs.gov.
        </p>
      </header>

      {!profile && (
        <section className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">
          Set up the <Link href="/planning/profile" className="underline">household profile</Link> first
          so we know who's contributing where (ages drive catch-up eligibility).
        </section>
      )}

      {byAccount.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Employer plan & HSA headroom ({currentYear})
          </h2>
          {byAccount.map((h, i) => (
            <HeadroomRow key={i} {...h} />
          ))}
        </section>
      )}

      {iraCombined.length > 0 && profile && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            IRA headroom — Traditional + Roth combined limit ({currentYear})
          </h2>
          {iraCombined.map((h) => (
            <div key={h.person} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {h.personLabel}
                    {h.catchupEligible && (
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        50+ catch-up
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Roth {formatCurrency(h.rothContributed)} · Traditional{" "}
                    {formatCurrency(h.traditionalContributed)} · Total{" "}
                    {formatCurrency(h.totalContributed)} of {formatCurrency(h.limit)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Remaining
                  </div>
                  <div className="text-lg font-bold text-emerald-300">
                    {formatCurrency(h.remaining)}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${Math.min(100, h.pctUsed * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {notes.length > 0 && (
        <section className="rounded-md border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
          <ul className="list-disc space-y-1 pl-4">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900">
        <header className="border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Contributions logged</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Enter each contribution as you make it. We total them per year per account.
          </p>
        </header>
        {contributions.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            None yet. Add your first one below.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-2">Year</th>
                <th className="px-4 py-2">Person</th>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {contributions.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-slate-300">{c.year}</td>
                  <td className="px-4 py-2 text-slate-300">{personLabel(c.person, profile)}</td>
                  <td className="px-4 py-2 text-slate-300">
                    {TAX_ACCOUNT_LABELS[c.accountType as TaxAccountType] ?? c.accountType}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-100">
                    {formatCurrency(c.amount)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{c.notes ?? ""}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteContributionButton id={c.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <TaxContributionForm
          primaryName={profile?.primaryName ?? "Primary"}
          secondaryName={profile?.secondaryName ?? "Spouse"}
        />
      </section>
    </div>
  );
}

function HeadroomRow({
  accountType,
  personLabel,
  limit,
  catchupEligible,
  contributed,
  remaining,
  pctUsed,
  note,
}: {
  accountType: TaxAccountType;
  person: string;
  personLabel: string;
  limit: number;
  catchupEligible: boolean;
  contributed: number;
  remaining: number;
  pctUsed: number;
  note?: string;
}) {
  void accountType;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">
            {personLabel}
            {catchupEligible && (
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                catch-up eligible
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {formatCurrency(contributed)} contributed of {formatCurrency(limit)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Remaining</div>
          <div className="text-lg font-bold text-emerald-300">{formatCurrency(remaining)}</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${Math.min(100, pctUsed * 100).toFixed(1)}%` }}
        />
      </div>
      {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function personLabel(person: string, profile: { primaryName?: string | null; secondaryName?: string | null } | null) {
  if (person === "primary") return profile?.primaryName ?? "Primary";
  if (person === "secondary") return profile?.secondaryName ?? "Spouse";
  if (person === "household") return "Household";
  return person;
}
