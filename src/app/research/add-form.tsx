"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Suggestion = { symbol: string; name: string; exchange: string | null };

export function AddTickerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) {
          // Don't surface every search error to the user; just log
          console.warn("[asset search]", data.error);
          setSuggestions([]);
        } else {
          setSuggestions(data.results ?? []);
        }
      } catch (e) {
        console.warn("[asset search]", e);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(s: Suggestion) {
    setSelectedSymbol(s.symbol);
    setQuery(`${s.symbol} — ${s.name}`);
    setShowSuggestions(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Figure out the symbol to add. Prefer a picked suggestion; fall back to
    // parsing whatever's in the input (uppercase, alphanumeric).
    let symbolToAdd = selectedSymbol;
    if (!symbolToAdd) {
      const raw = query.trim().toUpperCase();
      // If the user typed something like "AAPL — Apple Inc." manually, peel off.
      const dash = raw.indexOf(" —");
      const cleaned = (dash >= 0 ? raw.slice(0, dash) : raw).replace(/[^A-Z.\-]/g, "");
      if (cleaned) symbolToAdd = cleaned;
    }
    if (!symbolToAdd) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbolToAdd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setInfo(`Added ${data.symbol}${data.name ? ` (${data.name})` : ""}.`);
      setQuery("");
      setSelectedSymbol(null);
      setSuggestions([]);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
    >
      <div ref={containerRef} className="relative flex-1 min-w-[260px]">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add ticker
        </label>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedSymbol(null);
            setShowSuggestions(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by symbol or company name (AAPL, Apple, etc.)"
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-slate-500 focus:outline-none"
        />
        {showSuggestions && (suggestions.length > 0 || searching) && (
          <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
            {searching && suggestions.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-500">Searching…</div>
            )}
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={s.symbol}
                onClick={() => pick(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === activeIndex
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.symbol}</div>
                  <div className="truncate text-xs text-slate-500">{s.name}</div>
                </div>
                {s.exchange && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">
                    {s.exchange}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={busy || pending || !query.trim()}
        className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {busy || pending ? "Adding…" : "Add"}
      </button>
      {info && (
        <div className="w-full rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
          {info}
        </div>
      )}
      {error && (
        <div className="w-full rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </form>
  );
}
