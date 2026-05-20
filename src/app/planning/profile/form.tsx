"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FILING_STATUS_LABELS, type Profile } from "@/lib/db/schema";

export function ProfileForm({ initial }: { initial: Profile | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      primaryName: stringOrNull(fd.get("primaryName")),
      primaryDob: stringOrNull(fd.get("primaryDob")),
      secondaryName: stringOrNull(fd.get("secondaryName")),
      secondaryDob: stringOrNull(fd.get("secondaryDob")),
      filingStatus: stringOrNull(fd.get("filingStatus")),
      state: stringOrNull(fd.get("state")),
      numberOfDependents: intOrNull(fd.get("numberOfDependents")),
      primaryAnnualIncome: numOrNull(fd.get("primaryAnnualIncome")),
      secondaryAnnualIncome: numOrNull(fd.get("secondaryAnnualIncome")),
      primaryEmployerMatchPercent: pctOrNull(fd.get("primaryEmployerMatchPercent")),
      primaryEmployerMatchUpTo: pctOrNull(fd.get("primaryEmployerMatchUpTo")),
      secondaryEmployerMatchPercent: pctOrNull(fd.get("secondaryEmployerMatchPercent")),
      secondaryEmployerMatchUpTo: pctOrNull(fd.get("secondaryEmployerMatchUpTo")),
      hsaEligible: fd.get("hsaEligible") === "on",
      hsaCoverageType: stringOrNull(fd.get("hsaCoverageType")),
      notes: stringOrNull(fd.get("notes")),
    };

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-6"
    >
      <FormSection title="Primary">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              name="primaryName"
              defaultValue={initial?.primaryName ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Date of birth">
            <input
              name="primaryDob"
              type="date"
              defaultValue={initial?.primaryDob ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Annual gross income ($)">
            <input
              name="primaryAnnualIncome"
              type="number"
              step="1000"
              defaultValue={initial?.primaryAnnualIncome ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Employer 401(k) match (%)">
            <input
              name="primaryEmployerMatchPercent"
              type="number"
              step="0.1"
              placeholder="e.g. 4"
              defaultValue={
                initial?.primaryEmployerMatchPercent
                  ? initial.primaryEmployerMatchPercent * 100
                  : ""
              }
              className={inputCls}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Spouse">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              name="secondaryName"
              defaultValue={initial?.secondaryName ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Date of birth">
            <input
              name="secondaryDob"
              type="date"
              defaultValue={initial?.secondaryDob ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Annual gross income ($)">
            <input
              name="secondaryAnnualIncome"
              type="number"
              step="1000"
              defaultValue={initial?.secondaryAnnualIncome ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Employer 401(k) / 403(b) match (%)">
            <input
              name="secondaryEmployerMatchPercent"
              type="number"
              step="0.1"
              defaultValue={
                initial?.secondaryEmployerMatchPercent
                  ? initial.secondaryEmployerMatchPercent * 100
                  : ""
              }
              className={inputCls}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Household">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Filing status">
            <select
              name="filingStatus"
              defaultValue={initial?.filingStatus ?? "mfj"}
              className={inputCls}
            >
              {Object.entries(FILING_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="State (2-letter)">
            <input
              name="state"
              maxLength={2}
              placeholder="OK"
              defaultValue={initial?.state ?? ""}
              className={inputCls + " uppercase"}
            />
          </Field>
          <Field label="Number of dependents">
            <input
              name="numberOfDependents"
              type="number"
              min="0"
              defaultValue={initial?.numberOfDependents ?? ""}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950/60 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="hsaEligible"
              defaultChecked={initial?.hsaEligible ?? false}
              className="accent-emerald-500"
            />
            HSA-eligible (enrolled in a high-deductible health plan)
          </label>
          <div className="mt-2">
            <Field label="If yes, coverage type">
              <select
                name="hsaCoverageType"
                defaultValue={initial?.hsaCoverageType ?? "family"}
                className={inputCls}
              >
                <option value="">(not eligible)</option>
                <option value="self_only">Self-only</option>
                <option value="family">Family</option>
              </select>
            </Field>
          </div>
        </div>
      </FormSection>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          className={inputCls}
        />
      </Field>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          Saved.
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-300">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none";

function stringOrNull(v: FormDataEntryValue | null): string | null {
  const s = v ? String(v).trim() : "";
  return s || null;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  if (!v) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v: FormDataEntryValue | null): number | null {
  if (!v) return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
function pctOrNull(v: FormDataEntryValue | null): number | null {
  if (!v) return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n / 100 : null;
}
