import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FINDING_TYPE_LABELS, type FindingType } from "@/lib/db/schema";
import { FindingCard } from "./finding-card";
import { ScanButton } from "./scan-button";

export const dynamic = "force-dynamic";

export default async function FindingsPage(props: PageProps<"/findings">) {
  const sp = await props.searchParams;
  const showAll = sp.show === "all";

  const allFindings = db
    .select()
    .from(schema.findings)
    .orderBy(desc(schema.findings.updatedAt))
    .all();

  const now = Date.now();
  const active = allFindings.filter((f) => {
    if (f.status === "new") return true;
    if (f.status === "snoozed" && (f.snoozedUntil ?? 0) <= now) return true;
    return false;
  });
  const archive = allFindings.filter((f) => !active.includes(f));

  const visible = showAll ? allFindings : active;

  // Sort by severity (high → low), then amount descending
  const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...visible].sort((a, b) => {
    const sa = severityRank[a.severity] ?? 0;
    const sb = severityRank[b.severity] ?? 0;
    if (sa !== sb) return sb - sa;
    return (b.amount ?? 0) - (a.amount ?? 0);
  });

  const totalOpportunity = active
    .filter((f) => f.amount != null && f.amount > 0)
    .reduce((s, f) => s + (f.amount ?? 0), 0);

  // Lastest scan time across any finding
  const lastScannedAt = allFindings[0]?.scannedAt ?? null;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Findings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Opportunities the app spots in your data — places to save money, earn more,
            or fix something that's slipping. Run a scan whenever to refresh.
          </p>
        </div>
        <ScanButton lastScannedAt={lastScannedAt} />
      </section>

      {active.length === 0 && !showAll ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
          <p className="text-sm text-slate-400">
            {allFindings.length === 0
              ? "Nothing scanned yet. Hit “Scan now” above to find opportunities in your accounts and spending."
              : "No active findings. Either we found nothing, or you've already dealt with everything we surfaced."}
          </p>
          {archive.length > 0 && (
            <a
              href="/findings?show=all"
              className="mt-4 inline-flex rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Show {archive.length} dismissed/snoozed →
            </a>
          )}
        </section>
      ) : (
        <>
          {!showAll && totalOpportunity > 0 && (
            <section className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-200">
              <strong>~${Math.round(totalOpportunity).toLocaleString()}/year</strong>{" "}
              in potential savings or extra income across your {active.length} open finding
              {active.length === 1 ? "" : "s"} (rough estimate, before taxes).
            </section>
          )}

          <section className="space-y-3">
            {sorted.map((f) => (
              <FindingCard
                key={f.id}
                finding={{
                  id: f.id,
                  type: f.type as FindingType,
                  typeLabel: FINDING_TYPE_LABELS[f.type as FindingType] ?? f.type,
                  severity: f.severity,
                  title: f.title,
                  detail: f.detail,
                  suggestion: f.suggestion,
                  amount: f.amount,
                  status: f.status,
                  snoozedUntil: f.snoozedUntil,
                }}
              />
            ))}
          </section>

          <section className="text-center text-xs text-slate-500">
            {showAll ? (
              <a href="/findings" className="underline hover:text-slate-300">
                Hide dismissed/snoozed
              </a>
            ) : archive.length > 0 ? (
              <a href="/findings?show=all" className="underline hover:text-slate-300">
                Show {archive.length} dismissed/snoozed
              </a>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
