"use client";

import { EMPTY_FILTERS, isFiltered, toggle, type Filters } from "@/lib/filters";
import { CLASS_LEVELS, OPPORTUNITY_TYPES } from "@/lib/types";
import { TYPE_LABELS } from "./Badges";
import { ComingSoonTab, LOCKED_YEARS } from "./ComingSoonTab";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: number;
};

const YEAR_OPTIONS = [
  { year: CLASS_LEVELS.freshman, label: "Freshman", sub: "Class of 2030" },
  { year: CLASS_LEVELS.sophomore, label: "Sophomore", sub: "Class of 2029" },
];

export function FilterBar({ filters, onChange, resultCount }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <div className="z-20 -mx-4 mb-6 lg:sticky lg:top-16 border-b border-line bg-bg/85 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search opportunities</span>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Search companies, roles, locations…"
            className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-base outline-none sm:text-sm transition placeholder:text-muted focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>

        <div role="group" aria-label="Class year" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 sm:grid-cols-4">
          {YEAR_OPTIONS.map(({ year, label, sub }) => {
            const active = filters.gradYears.includes(year);
            return (
              <button
                key={year}
                aria-pressed={active}
                onClick={() => set({ gradYears: toggle(filters.gradYears, year) })}
                className={`rounded-lg px-3 py-1.5 text-left text-sm transition sm:px-4 ${
                  active ? "bg-accent text-on-accent shadow-sm" : "text-ink hover:bg-subtle"
                }`}
              >
                <span className="block font-semibold leading-tight">{label}</span>
                <span className={`block text-[11px] leading-tight ${active ? "opacity-80" : "text-muted"}`}>
                  {sub}
                </span>
              </button>
            );
          })}
          {LOCKED_YEARS.map(({ label, sub }) => (
            <ComingSoonTab key={label} label={label} sub={sub} className="rounded-lg px-3 py-1.5 text-sm sm:px-4" />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {OPPORTUNITY_TYPES.map((t) => (
          <Chip key={t} active={filters.types.includes(t)} onClick={() => set({ types: toggle(filters.types, t) })}>
            {TYPE_LABELS[t]}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Chip active={filters.remoteOnly} onClick={() => set({ remoteOnly: !filters.remoteOnly })}>
          Remote
        </Chip>
        <Chip active={filters.paidOnly} onClick={() => set({ paidOnly: !filters.paidOnly })}>
          Paid
        </Chip>
        <Chip active={filters.acceptingOnly} onClick={() => set({ acceptingOnly: !filters.acceptingOnly })}>
          Accepting now
        </Chip>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted" aria-live="polite">
            <strong className="font-semibold text-ink">{resultCount}</strong> open
          </span>
          {isFiltered(filters) && (
            <button onClick={() => onChange(EMPTY_FILTERS)} className="font-medium text-accent hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-ink bg-ink text-bg"
          : "border-line bg-surface text-muted hover:border-ink/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
