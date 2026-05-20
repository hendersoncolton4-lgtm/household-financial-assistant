"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MANUAL_CATEGORY_LABELS,
  type ManualCategory,
} from "@/lib/db/schema";

const DEBT_CATEGORIES: ManualCategory[] = [
  "mortgage",
  "auto_loan",
  "student_loan",
  "personal_loan",
  "credit_card",
  "other_debt",
];

export function NewManualAccountForm() {
  const router = useRouter();
  const [category, setCategory] = useState<ManualCategory>("mortgage");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDebt = DEBT_CATEGORIES.includes(category);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    // Convert interest rate from % to decimal for storage
    let interestRate: number | string | null = (fd.get("interestRate") as string) || null;
    if (interestRate) {
      const pct = parseFloat(String(interestRate));
      if (Number.isFinite(pct)) interestRate = pct / 100;
    }

    const body = {
      category,
      name: fd.get("name"),
      lenderName: fd.get("lenderName"),
      currentBalance: fd.get("currentBalance"),
      interestRate,
      monthlyPayment: fd.get("monthlyPayment"),
      originalPrincipal: fd.get("originalPrincipal"),
      notes: fd.get("notes"),
    };

    try {
      const res = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add account");
        setBusy(false);
        return;
      }
      router.push("/accounts");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-lg border border-slate-800 bg-slate-900 p-6"
    >
      <Field label="What kind of account?">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ManualCategory)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
        >
          <optgroup label="Debts">
            {DEBT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{MANUAL_CATEGORY_LABELS[c]}</option>
            ))}
          </optgroup>
          <optgroup label="Assets">
            <option value="cash">{MANUAL_CATEGORY_LABELS.cash}</option>
            <option value="investment">{MANUAL_CATEGORY_LABELS.investment}</option>
            <option value="other_asset">{MANUAL_CATEGORY_LABELS.other_asset}</option>
          </optgroup>
        </select>
      </Field>

      <Field label="Account name">
        <input
          name="name"
          required
          placeholder={PLACEHOLDERS[category]}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </Field>

      <Field label={isDebt ? "Lender / servicer" : "Institution (optional)"}>
        <input
          name="lenderName"
          placeholder={LENDER_PLACEHOLDERS[category] ?? "e.g. Bank of America"}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </Field>

      <Field label={isDebt ? "Current balance owed ($)" : "Current balance ($)"}>
        <input
          name="currentBalance"
          type="number"
          step="0.01"
          required
          placeholder={isDebt ? "245000" : "25000"}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
        {isDebt && (
          <p className="mt-1 text-xs text-slate-500">
            Enter what you owe today as a positive number.
          </p>
        )}
      </Field>

      {isDebt && (
        <>
          <Field label="Interest rate / APR (%)">
            <input
              name="interestRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="6.5"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Monthly payment ($)">
            <input
              name="monthlyPayment"
              type="number"
              step="0.01"
              min="0"
              placeholder="1800"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </Field>
          {(category === "mortgage" ||
            category === "auto_loan" ||
            category === "student_loan" ||
            category === "personal_loan") && (
            <Field label="Original principal ($) — optional">
              <input
                name="originalPrincipal"
                type="number"
                step="0.01"
                min="0"
                placeholder="400000"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-500">
                Lets us show how much you've paid down over time.
              </p>
            </Field>
          )}
        </>
      )}

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          rows={2}
          placeholder={isDebt ? "e.g. 30-year fixed, started March 2023" : ""}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </Field>

      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          {busy ? "Saving…" : "Add account"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const PLACEHOLDERS: Record<ManualCategory, string> = {
  mortgage: "Mortgage — 123 Main St",
  auto_loan: "2023 Toyota Camry",
  student_loan: "Sallie Mae loan",
  personal_loan: "SoFi personal loan",
  credit_card: "Amex Platinum",
  other_debt: "Other debt",
  cash: "Vault cash",
  investment: "Crypto wallet",
  other_asset: "House value (estimate)",
};

const LENDER_PLACEHOLDERS: Partial<Record<ManualCategory, string>> = {
  mortgage: "e.g. Mr. Cooper, Rocket Mortgage",
  auto_loan: "e.g. Toyota Financial, Ford Motor Credit",
  student_loan: "e.g. Nelnet, MOHELA, Sallie Mae",
  personal_loan: "e.g. SoFi, Lightstream",
  credit_card: "e.g. American Express",
  other_debt: "Lender name",
};
