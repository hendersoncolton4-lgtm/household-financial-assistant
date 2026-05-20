"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function CongressFilterBar({
  legislator,
  ticker,
  chamber,
  side,
  since,
  allLegislators,
}: {
  legislator: string;
  ticker: string;
  chamber: string;
  side: string;
  since: string;
  allLegislators: Array<{ name: string; chamber: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Local input state so typing doesn't refire the URL on every keystroke
  const [legInput, setLegInput] = useState(legislator);
  const [tickInput, setTickInput] = useState(ticker);

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "" || v === "all") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/congress?${qs}` : "/congress");
    });
  }

  function clearAll() {
    setLegInput("");
    setTickInput("");
    startTransition(() => router.push("/congress"));
  }

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Legislator
          </label>
          <input
            list="legislators"
            value={legInput}
            onChange={(e) => setLegInput(e.target.value)}
            onBlur={() => update({ legislator: legInput })}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ legislator: legInput });
            }}
            placeholder="Pelosi, Cruz, Warren…"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
          <datalist id="legislators">
            {allLegislators.map((l) => (
              <option key={`${l.name}|${l.chamber}`} value={l.name}>
                {l.chamber === "house" ? "(H)" : "(S)"} {l.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Ticker
          </label>
          <input
            value={tickInput}
            onChange={(e) => setTickInput(e.target.value.toUpperCase())}
            onBlur={() => update({ ticker: tickInput })}
            onKeyDown={(e) => {
              if (e.key === "Enter") update({ ticker: tickInput });
            }}
            placeholder="AAPL"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm uppercase text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Chamber
          </label>
          <select
            value={chamber}
            onChange={(e) => update({ chamber: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="all">Both</option>
            <option value="senate">Senate</option>
            <option value="house">House</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Side
          </label>
          <select
            value={side}
            onChange={(e) => update({ side: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            <option value="all">All</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="exchange">Exchange</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Since (trade date)
          </label>
          <input
            type="date"
            value={since}
            onChange={(e) => update({ since: e.target.value })}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          />
        </div>
      </div>
      {(legislator || ticker || chamber !== "all" || side !== "all") && (
        <button
          onClick={clearAll}
          disabled={pending}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Clear filters
        </button>
      )}
    </section>
  );
}
