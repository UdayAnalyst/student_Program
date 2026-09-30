"use client";

import { useEffect } from "react";
import { formatDate } from "@/lib/dates";
import type { ProgramDetails } from "@/lib/programDetails";
import type { Opportunity } from "@/lib/types";
import type { SavedStatus } from "@/lib/useSaved";
import { DeadlineBadge, GradYearBadge, TypeBadge } from "./Badges";
import { CompanyAvatar } from "./CompanyAvatar";
import { BookmarkIcon, NotifyButton } from "./OpportunityCard";

const SOURCE_LABEL: Record<Opportunity["gradYearSource"], string> = {
  scraped: "Pulled from the posting",
  keyword: "Keyword match in the posting",
  manual: "Verified by our team",
};

type Props = {
  opportunity: Opportunity;
  status?: SavedStatus;
  onClose: () => void;
  onSetStatus: (s: SavedStatus | null) => void;
  onNotify?: () => void;
  watching?: boolean;
};

export function DetailDrawer({ opportunity: o, status, onClose, onSetStatus, onNotify, watching }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal aria-labelledby="drawer-title">
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <aside className="animate-drawer relative flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <button
            onClick={onClose}
            autoFocus
            className="mb-6 inline-flex items-center gap-1.5 rounded-lg text-sm text-muted hover:text-ink"
          >
            <span aria-hidden>←</span> Back to results
          </button>

          <div className="flex items-center gap-4">
            <CompanyAvatar name={o.company} logo={o.logo} size="lg" />
            <div className="min-w-0">
              <p className="text-sm text-muted">{o.company}</p>
              <h2 id="drawer-title" className="text-xl font-semibold leading-tight tracking-tight">
                {o.title}
              </h2>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {[...o.gradYears]
              .sort((a, b) => b - a)
              .map((y) => (
                <GradYearBadge key={y} year={y} />
              ))}
            <TypeBadge type={o.type} />
            <DeadlineBadge deadline={o.deadline} status={o.statusLabel} />
          </div>

          {o.accepting !== undefined && (
            <section
              className={`mt-6 rounded-xl px-4 py-3 ${o.accepting ? "bg-ok-soft" : "bg-warn-soft"}`}
            >
              <p className={`text-sm font-semibold ${o.accepting ? "text-ok" : "text-warn"}`}>
                {o.accepting ? "✓ Accepting applications now" : "Not accepting applications yet"}
              </p>
              {o.accepting && o.deadline && (
                <p className="mt-1 text-sm">Apply by {formatDate(o.deadline)}.</p>
              )}
              {!o.accepting && o.applyWindow && (
                <p className="mt-1 text-sm">
                  {o.applyWindow}.
                  {o.applyWindowSource === "past cycles" && (
                    <span className="text-muted"> Based on previous years, so dates may shift.</span>
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">Checked {formatDate(o.verifiedAt)}</p>
            </section>
          )}

          {o.gradYearEvidence && (
            <section className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Why you&apos;re eligible</h3>
              <blockquote className="mt-3 rounded-xl border-l-4 border-accent bg-accent-soft/60 px-4 py-3 text-[15px] leading-relaxed">
                “{o.gradYearEvidence}”
              </blockquote>
              <p className="mt-2 text-xs text-muted">{SOURCE_LABEL[o.gradYearSource]}</p>
            </section>
          )}

          {o.description && !o.details && (
            <section className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">About the program</h3>
              <p className="mt-3 leading-relaxed">{o.description}</p>
            </section>
          )}

          {o.details && <ProgramSections details={o.details} />}

          {o.companyAbout && (
            <section className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                About {o.company}
                {o.companyFocus && <span className="ml-2 normal-case tracking-normal">· {o.companyFocus}</span>}
              </h3>
              <p className="mt-3 leading-relaxed">{o.companyAbout}</p>
            </section>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
            <Detail label="Location" value={o.remote && o.location !== "Remote" ? `${o.location} · Remote` : o.location} />
            <Detail label="Compensation" value={o.paid === undefined ? "Not listed" : o.paid ? "Paid" : "Unpaid"} />
            <Detail label="Deadline" value={o.deadline ? formatDate(o.deadline) : (o.statusLabel ?? "Rolling")} />
            <Detail label="Last verified" value={formatDate(o.verifiedAt)} />
          </dl>

          {o.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {o.tags.map((t) => (
                <span key={t} className="rounded-md bg-subtle px-2 py-1 text-xs text-muted">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-line bg-surface p-4 sm:px-8">
          <a
            href={o.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent font-semibold text-on-accent transition hover:brightness-110"
          >
            {o.accepting === false ? "Visit page" : "Apply"} <span aria-hidden>↗</span>
          </a>
          {o.accepting === false && onNotify && (
            <NotifyButton watching={watching} onClick={onNotify} className="h-11 rounded-xl px-4 text-sm" />
          )}
          <button
            onClick={() => onSetStatus(status ? null : "saved")}
            aria-pressed={!!status}
            className={`flex h-11 items-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition ${
              status ? "border-accent text-accent" : "border-line hover:border-ink/40"
            }`}
          >
            <BookmarkIcon filled={!!status} />
            {status ? "Saved" : "Save"}
          </button>
          {o.accepting !== false && <button
            onClick={() => onSetStatus(status === "applied" ? "saved" : "applied")}
            aria-pressed={status === "applied"}
            className={`h-11 rounded-xl border px-4 text-sm font-medium transition ${
              status === "applied" ? "border-ok bg-ok-soft text-ok" : "border-line hover:border-ink/40"
            }`}
          >
            {status === "applied" ? "Applied ✓" : "Mark applied"}
          </button>}
        </footer>
      </aside>
    </div>
  );
}

const AUDIENCE_HEADING: Record<ProgramDetails["audience"]["kind"], string> = {
  open: "Open to everyone who meets the requirements",
  encourages: "Open to all, with a focus on some groups",
  focused: "Designed for a specific group",
};

function ProgramSections({ details: d }: { details: ProgramDetails }) {
  return (
    <>
      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">What to expect</h3>
        <p className="mt-3 text-sm font-medium">{d.format}</p>
        <BulletList items={d.expect} />
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">What you could walk away with</h3>
        <BulletList items={d.outcomes} marker="★" />
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Who it&apos;s for</h3>
        <div
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${d.audience.kind === "open" ? "bg-subtle" : "bg-ok-soft"}`}
        >
          <p className="font-semibold">{AUDIENCE_HEADING[d.audience.kind]}</p>
          <p className="mt-1 leading-relaxed">{d.audience.detail}</p>
        </div>
        <p className="mt-4 text-xs font-semibold text-muted">Requirements</p>
        <BulletList items={d.requirements} marker="✓" />
        {d.note && <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink/90">⚠️ {d.note}</p>}
        <p className="mt-3 text-xs text-muted">
          {d.source === "program page"
            ? "From the program's own page."
            : "Based on previous years' postings; details may change for 2027."}
        </p>
      </section>
    </>
  );
}

function BulletList({ items, marker = "•" }: { items: string[]; marker?: string }) {
  return (
    <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="text-accent">
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
