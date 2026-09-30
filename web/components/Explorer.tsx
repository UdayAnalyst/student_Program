"use client";

import { useCallback, useMemo, useState } from "react";
import { applyFilters, EMPTY_FILTERS, type Filters } from "@/lib/filters";
import type { Opportunity } from "@/lib/types";
import { useSaved } from "@/lib/useSaved";
import { useWatchlist } from "@/lib/useWatchlist";
import { DetailDrawer } from "./DetailDrawer";
import { FilterBar } from "./FilterBar";
import { Hero } from "./Hero";
import { OpportunityCard } from "./OpportunityCard";
import { SmsSignupModal } from "./SmsSignupModal";

export function Explorer({ opportunities }: { opportunities: Opportunity[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // SMS sign-up modal: {} = general alerts, { watch } = "Notify me" for one program.
  const [alerts, setAlerts] = useState<{ watch?: Opportunity } | null>(null);
  const { saved, toggleSaved, setStatus } = useSaved();
  const { isWatching } = useWatchlist();

  const open = useMemo(() => applyFilters(opportunities, EMPTY_FILTERS), [opportunities]);
  const results = useMemo(() => applyFilters(opportunities, filters), [opportunities, filters]);
  const selected = opportunities.find((o) => o.id === selectedId);

  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const closeAlerts = useCallback(() => setAlerts(null), []);

  return (
    <>
      <Hero opportunities={open} onGetAlerts={() => setAlerts({})} />

      <section id="feed" className="mx-auto w-full max-w-6xl scroll-mt-16 px-4 pb-28 sm:px-6">
        <FilterBar filters={filters} onChange={setFilters} resultCount={results.length} />

        {results.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((o) => (
              <OpportunityCard
                key={o.id}
                opportunity={o}
                status={saved[o.id]}
                onOpen={() => setSelectedId(o.id)}
                onToggleSave={() => toggleSaved(o.id)}
                onNotify={() => setAlerts({ watch: o })}
                watching={isWatching(o.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-lg font-semibold">No matches yet</p>
            <p className="mt-1 text-sm text-muted">Try removing a filter, or get a text as soon as something opens.</p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium"
              >
                Clear filters
              </button>
              <button
                onClick={() => setAlerts({})}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
              >
                Get text alerts
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Floating alerts button, always within reach while scrolling the feed */}
      <button
        onClick={() => setAlerts({})}
        className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-on-accent shadow-xl shadow-accent/30 transition hover:brightness-110"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinejoin="round" d="M4 5h16v11H9l-5 4V5Z" />
        </svg>
        Text me new ones
      </button>

      {selected && (
        <DetailDrawer
          opportunity={selected}
          status={saved[selected.id]}
          onClose={closeDrawer}
          onSetStatus={(s) => setStatus(selected.id, s)}
          onNotify={() => setAlerts({ watch: selected })}
          watching={isWatching(selected.id)}
        />
      )}
      {alerts && <SmsSignupModal onClose={closeAlerts} watch={alerts.watch} />}
    </>
  );
}
