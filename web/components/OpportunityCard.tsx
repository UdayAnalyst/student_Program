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
};

export function OpportunityCard({ opportunity: o, status, onOpen, onToggleSave, onNotify, watching }: Props) {
  return (
    <article className="group relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/25">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={o.company} logo={o.logo} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted">
            {o.company}
            {o.companyFocus && <span className="opacity-70"> · {o.companyFocus}</span>}
          </p>
          <h3 className="font-semibold leading-snug">
            {/* Stretched button: the whole card opens the drawer */}
            <button
              onClick={onOpen}
              className="text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none"
            >
              {o.title}
            </button>
          </h3>
        </div>
        <button
          onClick={onToggleSave}
          aria-pressed={!!status}
          aria-label={status ? "Remove from saved" : "Save"}
          className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border transition ${
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
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
