"use client";

import type { Opportunity } from "@/lib/types";
import type { SavedStatus } from "@/lib/useSaved";
import { DeadlineBadge, GradYearBadge, TypeBadge } from "./Badges";
import { CompanyAvatar } from "./CompanyAvatar";

type Props = {
  opportunity: Opportunity;
  status?: SavedStatus;
  onOpen: () => void;
  onToggleSave: () => void;
  onNotify?: () => void; // shown for programs not accepting applications yet
  watching?: boolean;
  index?: number; // editorial numbering, e.g. "01"
};

export function OpportunityCard({
  opportunity: o,
  status,
  onOpen,
  onToggleSave,
  onNotify,
  watching,
  index,
}: Props) {
  return (
    <article className="group relative flex w-full flex-col gap-4 rounded-md border border-line bg-surface p-5 transition duration-300 hover:-translate-y-1 hover:border-ink hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.25)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={o.company} logo={o.logo} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">
            {index !== undefined && (
              <span className="mr-2 font-mono text-[11px]">{String(index).padStart(2, "0")}</span>
            )}
            <span className="font-medium text-ink">{o.company}</span>
            {o.companyFocus && <span> · {o.companyFocus}</span>}
          </p>
          <h3 className="mt-1 font-serif text-[1.35rem] font-normal leading-[1.15] tracking-tight">
            {/* Stretched button: the whole card opens the drawer */}
            <button
              onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-md focus-visible:outline-none"
            >
              {o.title}
            </button>
          </h3>
        </div>
        <button
          onClick={onToggleSave}
          aria-pressed={!!status}
          aria-label={status ? "Remove from saved" : "Save"}
          className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-md border transition ${
            status
              ? "border-accent bg-accent text-on-accent"
              : "border-line text-muted hover:border-accent hover:text-accent"
          }`}
        >
          <BookmarkIcon filled={!!status} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[...o.gradYears]
          .sort((a, b) => b - a)
          .map((y) => (
            <GradYearBadge key={y} year={y} />
          ))}
        <TypeBadge type={o.type} />
        {o.details && o.details.audience.kind !== "open" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">
            {o.details.audience.kind === "focused" ? "For: " : ""}
            {o.details.audience.label}
          </span>
        )}
      </div>

      {o.accepting === false && (
        <div className="relative z-10 flex items-center justify-between gap-3 rounded-xl bg-warn-soft px-3 py-2">
          <p className="text-xs leading-snug text-ink/80">
            <span className="font-semibold text-warn">Not accepting yet.</span> {o.applyWindow}
          </p>
          {onNotify && (
            <NotifyButton watching={watching} onClick={onNotify} className="shrink-0" />
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4 text-sm">
        <span className="truncate text-muted">
          {o.location}
          {o.paid ? " · Paid" : ""}
        </span>
        <DeadlineBadge deadline={o.deadline} status={o.statusLabel} />
      </div>

      {status === "applied" && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-ok px-2 py-0.5 text-[11px] font-semibold text-on-accent">
          Applied ✓
        </span>
      )}
    </article>
  );
}

export function NotifyButton({
  watching,
  onClick,
  className = "",
}: {
  watching?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={watching}
      aria-pressed={watching}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        watching ? "bg-ok-soft text-ok" : "bg-ink text-bg hover:opacity-90"
      } ${className}`}
    >
      <span aria-hidden>{watching ? "✓" : "🔔"}</span>
      {watching ? "We'll text you" : "Notify me"}
    </button>
  );
}

export function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinejoin="round" d="M6 3.5h12v17l-6-4-6 4v-17Z" />
    </svg>
  );
}
