import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { GenerateReviewButton } from "./generate-button";

export const dynamic = "force-dynamic";

export default function ReviewsPage() {
  const reviews = db
    .select()
    .from(schema.monthlyReviews)
    .orderBy(desc(schema.monthlyReviews.periodEnd))
    .all();

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Monthly reviews</h1>
          <p className="mt-1 text-sm text-slate-400">
            On-demand 30-day reviews of your household finances, written by your
            assistant using live account and goal data.
          </p>
        </div>
        <GenerateReviewButton />
      </section>

      {reviews.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-sm text-slate-400">
          No reviews yet. Generate your first one — it takes 10–20 seconds and uses your live data.
        </section>
      ) : (
        <ul className="space-y-6">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-800 bg-slate-900">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-100">
                    Generated {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  {r.netWorthSnapshot != null && (
                    <Snap label="Net worth" value={formatCurrency(r.netWorthSnapshot)} />
                  )}
                  {r.inflowSnapshot != null && (
                    <Snap label="In" value={formatCurrency(r.inflowSnapshot)} />
                  )}
                  {r.outflowSnapshot != null && (
                    <Snap label="Out" value={formatCurrency(r.outflowSnapshot)} />
                  )}
                </div>
              </header>
              <article className="prose prose-invert max-w-none px-5 py-5 text-sm">
                <RenderMarkdown content={r.content} />
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Snap({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-200">{value}</div>
    </div>
  );
}

/**
 * Very lightweight Markdown renderer — handles headings, bold, italic, lists,
 * paragraphs, and inline code. Good enough for the structured review output
 * without pulling in a full Markdown library.
 */
function RenderMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-slate-300">
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };
  const flushPara = (key: string) => {
    if (paraBuffer.length === 0) return;
    out.push(
      <p key={key} className="my-2 text-slate-300">
        {renderInline(paraBuffer.join(" "))}
      </p>
    );
    paraBuffer = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);

    if (h2) {
      flushList(`fl-${i}`);
      flushPara(`fp-${i}`);
      out.push(
        <h2 key={`h2-${i}`} className="mt-5 mb-1 text-lg font-semibold text-slate-100">
          {h2[1]}
        </h2>
      );
    } else if (h3) {
      flushList(`fl-${i}`);
      flushPara(`fp-${i}`);
      out.push(
        <h3 key={`h3-${i}`} className="mt-4 mb-1 text-base font-semibold text-slate-200">
          {h3[1]}
        </h3>
      );
    } else if (li) {
      flushPara(`fp-${i}`);
      listBuffer.push(li[1]);
    } else if (line === "") {
      flushList(`fl-${i}`);
      flushPara(`fp-${i}`);
    } else {
      flushList(`fl-${i}`);
      paraBuffer.push(line);
    }
  });
  flushList("fl-end");
  flushPara("fp-end");
  return <>{out}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold + inline code + italic; very simple parser
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={idx++} className="text-slate-100">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={idx++} className="rounded bg-slate-800 px-1 text-xs text-slate-200">
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(<em key={idx++}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
