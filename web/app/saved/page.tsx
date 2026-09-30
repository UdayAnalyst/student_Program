"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DetailDrawer } from "@/components/DetailDrawer";
import { OpportunityCard } from "@/components/OpportunityCard";
import { byDeadline, opportunities } from "@/lib/opportunities";
import { useSaved, type SavedStatus } from "@/lib/useSaved";

const TABS: { key: SavedStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "saved", label: "To apply" },
  { key: "applied", label: "Applied" },
];

export default function SavedPage() {
  const { saved, toggleSaved, setStatus } = useSaved();
  const [tab, setTab] = useState<SavedStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const mine = opportunities.filter((o) => saved[o.id]).sort(byDeadline);
  const shown = tab === "all" ? mine : mine.filter((o) => saved[o.id] === tab);
  const selected = opportunities.find((o) => o.id === selectedId);
  const appliedCount = mine.filter((o) => saved[o.id] === "applied").length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-5xl font-light tracking-tight">Your tracker</h1>
          <p className="mt-1 text-muted">
            {mine.length === 0
              ? "Save opportunities to keep track of deadlines."
              : `${appliedCount} of ${mine.length} applied. Keep going!`}
          </p>
        </div>
        {mine.length > 0 && (
          <div role="tablist" className="flex rounded-xl border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.key ? "bg-ink text-bg" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {mine.length > 0 && (
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-subtle" aria-hidden>
          <div
            className="h-full rounded-full bg-ok transition-all duration-500"
            style={{ width: `${(appliedCount / mine.length) * 100}%` }}
          />
        </div>
      )}

      {shown.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((o) => (
            <OpportunityCard
              key={o.id}
              opportunity={o}
              status={saved[o.id]}
              onOpen={() => setSelectedId(o.id)}
              onToggleSave={() => toggleSaved(o.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <p className="text-lg font-semibold">{mine.length === 0 ? "Nothing saved yet" : "Nothing here yet"}</p>
          <p className="mt-1 text-sm text-muted">Tap the bookmark on any opportunity to add it here.</p>
          <Link
            href="/#feed"
            className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
          >
            Browse opportunities
          </Link>
        </div>
      )}

      {selected && (
        <DetailDrawer
          opportunity={selected}
          status={saved[selected.id]}
          onClose={closeDrawer}
          onSetStatus={(s) => setStatus(selected.id, s)}
        />
      )}
    </main>
  );
}
