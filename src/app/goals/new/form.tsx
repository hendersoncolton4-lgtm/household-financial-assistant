"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOAL_TYPE_LABELS, type GoalType } from "@/lib/db/schema";

type AccountOption = {
  id: string;
  label: string;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
};

export function NewGoalForm({ accountOptions }: { accountOptions: AccountOption[] }) {
  const router = useRouter();
  const [type, setType] = useState<GoalType>("emergency_fund");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      type,
      name: fd.get("name"),
      targetAmount: fd.get("targetAmount"),
      targetDate: fd.get("targetDate"),
      linkedAccountId: fd.get("linkedAccountId") || null,
      startingAmount: fd.get("startingAmount"),
      startingAmountDate: fd.get("startingAmountDate"),
      monthlyContribution: fd.get("monthlyContribution"),
      expectedReturnRate: fd.get("expectedReturnRate"),
      notes: fd.get("notes"),
    };

    // savings_rate: convert percentage input to decimal
    if (type === "savings_rate" && body.targetAmount) {
      const pct = parseFloat(String(body.targetAmount));
      if (!Number.isNaN(pct)) body.targetAmount = pct / 100;
    }
    // retirement: convert return rate percentage to decimal
    if (type === "retirement" && body.expectedReturnRate) {
      const pct = parseFloat(String(body.expectedReturnRate));
      if (!Number.isNaN(pct)) body.expectedReturnRate = pct / 100;
    }

    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create goal");
        setBusy(false);
        return;
      }
      router.push("/goals");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  const accountsByType = (kinds: string[]) =>
    accountOptions.filter((a) => kinds.includes(a.type));

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-lg border border-slate-800 bg-slate-900 p-6">
      <Field label="Goal type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as GoalType)}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
        >
          {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map((t) => (
            <option key={t} value={t}>
              {GOAL_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">{HELP[type]}</p>
      </Field>

      <Field label="Name">
        <input
          name="name"
          required
          placeholder={NAME_PLACEHOLDERS[type]}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </Field>

      {(type === "emergency_fund" || type === "savings" || type === "retirement" || type === "custom") && (
        <Field label="Target amount ($)">
          <input
            name="targetAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="50000"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
        </Field>
      )}

      {type === "savings_rate" && (
        <Field label="Target savings rate (% of income)">
          <input
            name="targetAmount"
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="20"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-500">e.g. 20 means save 20% of monthly income.</p>
        </Field>
      )}

      {(type === "emergency_fund" || type === "savings" || type === "debt_payoff" || type === "retirement" || type === "custom") && (
        <Field label="Target date (optional)">
          <input
            name="targetDate"
            type="date"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
          />
        </Field>
      )}

      {(type === "emergency_fund" || type === "savings" || type === "custom") && accountOptions.length > 0 && (
        <Field label="Linked account (optional)">
          <select
            name="linkedAccountId"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
            defaultValue=""
          >
            <option value="">(none — sum all relevant accounts)</option>
            {accountsByType(["depository", "investment"]).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {type === "retirement" && accountOptions.length > 0 && (
        <>
          <Field label="Monthly contribution ($)">
            <input
              name="monthlyContribution"
              type="number"
              step="0.01"
              min="0"
              placeholder="1500"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Expected annual return (%)">
            <input
              name="expectedReturnRate"
              type="number"
              step="0.1"
              min="0"
              max="20"
              defaultValue="7"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              7% is a common long-run real (inflation-adjusted) US equity assumption. Past returns ≠ future returns; this is a rough estimate, not a guarantee.
            </p>
          </Field>
        </>
      )}

      {type === "debt_payoff" && (
        <>
          <Field label="Account to pay off">
            <select
              name="linkedAccountId"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>
                Pick a credit or loan account
              </option>
              {accountsByType(["credit", "loan"]).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            {accountsByType(["credit", "loan"]).length === 0 && (
              <p className="mt-1 text-xs text-amber-400">
                No credit or loan accounts found. Connect one on the Connect page first.
              </p>
            )}
          </Field>
          <Field label="Starting balance (optional — defaults to current balance)">
            <input
              name="startingAmount"
              type="number"
              step="0.01"
              min="0"
              placeholder="(blank = use current balance as baseline)"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
            />
          </Field>
        </>
      )}

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          rows={2}
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
          {busy ? "Saving…" : "Create goal"}
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

const HELP: Record<GoalType, string> = {
  emergency_fund: "Cash buffer in checking/savings. Rule of thumb: 3–6 months of expenses.",
  debt_payoff: "Pay a credit card or loan to zero.",
  savings: "Generic savings target (down payment, big purchase, etc.).",
  retirement: "Long-horizon investing target with monthly contributions and a return assumption.",
  savings_rate: "% of income saved each month.",
  custom: "Anything else.",
};

const NAME_PLACEHOLDERS: Record<GoalType, string> = {
  emergency_fund: "Emergency fund",
  debt_payoff: "Pay off Visa",
  savings: "Down payment",
  retirement: "Retirement at 60",
  savings_rate: "Save 20% of income",
  custom: "My goal",
};
