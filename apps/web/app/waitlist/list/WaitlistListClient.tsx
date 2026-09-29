"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, ArrowLeft, Users, Database } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Entry = {
  email: string;
  firstName?: string;
  source?: string;
  market?: string;
  status?: string;
  referral?: string;
  createdAt?: string;
};

/**
 * Draft admin view: every email captured by the waitlist, newest first.
 * Reads the dev-only /api/v1/waitlist/preview endpoint (JSON mode). In
 * production this surface is replaced by the JWT-gated /entries endpoint.
 */
export default function WaitlistListClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/waitlist/preview?format=json", { cache: "no-store" });
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      const json = await res.json();
      setEntries(json?.data?.entries ?? []);
      setTotal(json?.data?.total ?? 0);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load signups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const fmtDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--obiren-bg)] text-[var(--obiren-text)] font-sans">
      <header className="border-b border-[var(--obiren-border)]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <a href="/waitlist" aria-label="Back to waitlist" className="shrink-0">
              <BrandLogo height={38} priority />
            </a>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold font-display">Waitlist signups</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--obiren-text-faint)]">
                Draft preview
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border border-[var(--obiren-border)] bg-[var(--obiren-surface)] hover:border-[#9B6BFF] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9B6BFF]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight flex items-center gap-3">
              <Users className="w-6 h-6 text-[#9B6BFF]" aria-hidden="true" />
              {total} {total === 1 ? "person" : "people"} on the list
            </h1>
            <p className="mt-2 text-xs text-[var(--obiren-text-faint)] flex items-center gap-1.5">
              <Database className="w-3 h-3" aria-hidden="true" />
              MongoDB, collection waitlist_entries
              {lastUpdated && ` · updated ${fmtDate(lastUpdated.toISOString())}`}
            </p>
          </div>
          <a
            href="/waitlist"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#9B6BFF] light:text-[#6D4AFF] hover:underline underline-offset-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            Back to waitlist
          </a>
        </motion.div>

        {error && (
          <div className="rounded-2xl px-4 py-3 text-xs font-semibold bg-red-500/10 border border-red-400/30 text-red-500 light:text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading && entries.length === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--obiren-text-faint)]">Loading signups…</div>
        ) : total === 0 ? (
          <div className="py-20 text-center text-sm text-[var(--obiren-text-faint)]">
            No signups yet. Be the first at <a href="/waitlist" className="text-[#9B6BFF] light:text-[#6D4AFF] underline underline-offset-4">/waitlist</a>.
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--obiren-border)] bg-[var(--obiren-surface)] overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[3.5rem_1fr_6rem_6.5rem_6rem] gap-x-4 px-5 py-3 border-b border-[var(--obiren-border)] text-[10px] uppercase font-bold tracking-[0.14em] text-[var(--obiren-text-faint)]">
              <span>#</span>
              <span>Email</span>
              <span className="hidden sm:block">Source</span>
              <span className="hidden sm:block">Joined</span>
              <span className="text-right">Status</span>
            </div>
            <ul>
              {entries.map((e, i) => (
                <li
                  key={`${e.email}-${i}`}
                  className="grid grid-cols-[3rem_1fr_auto] sm:grid-cols-[3.5rem_1fr_6rem_6.5rem_6rem] gap-x-4 items-center px-5 py-3.5 border-b border-[var(--obiren-border)] last:border-b-0 text-sm hover:bg-[var(--obiren-surface-2)] transition-colors"
                >
                  <span className="font-bold text-[#9B6BFF] light:text-[#6D4AFF]">#{total - i}</span>
                  <span className="font-semibold truncate" title={e.email}>
                    {e.email}
                    {e.firstName && (
                      <span className="ml-2 text-xs font-normal text-[var(--obiren-text-faint)]">{e.firstName}</span>
                    )}
                  </span>
                  <span className="hidden sm:block text-xs text-[var(--obiren-text-muted)]">{e.source || "web"}</span>
                  <span className="hidden sm:block text-xs text-[var(--obiren-text-muted)]">{fmtDate(e.createdAt)}</span>
                  <span className="text-right">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-[var(--obiren-surface-2)] border border-[var(--obiren-border)] text-[var(--obiren-text-muted)]">
                      {e.status || "pending"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-[11px] text-[var(--obiren-text-faint)]">
          Dev-only draft view, auto-refreshes every 15s. Production uses the admin-gated
          /api/v1/waitlist/entries endpoint.
        </p>
      </main>
    </div>
  );
}
