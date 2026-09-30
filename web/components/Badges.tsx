import { daysUntil, formatDate } from "@/lib/dates";
import { levelForYear, type OpportunityType } from "@/lib/types";

const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

// Without a deadline, shows the verified status instead, e.g. "Open now" or "Opens Jan 11".
export function DeadlineBadge({ deadline, status }: { deadline: string | null; status?: string }) {
  if (!deadline) {
    const text = status ?? "Rolling";
    const tone = /^open now|^rolling/i.test(text)
      ? "bg-ok-soft text-ok"
      : /^opens/i.test(text)
        ? "bg-accent-soft text-accent"
        : /^not open/i.test(text)
          ? "bg-warn-soft text-warn"
          : "bg-subtle text-muted";
    return <span className={`${base} shrink-0 ${tone}`}>{text}</span>;
  }

  const days = daysUntil(deadline);
  let label = `Due ${formatDate(deadline)}`;
  let tone = "bg-subtle text-muted";
  if (days < 0) label = "Closed";
  else if (days === 0) [label, tone] = ["Closes today", "bg-danger-soft text-danger"];
  else if (days <= 7)
    [label, tone] = [`Closes in ${days} day${days === 1 ? "" : "s"}`, "bg-danger-soft text-danger"];
  else if (days <= 21) [label, tone] = [`${days} days left`, "bg-warn-soft text-warn"];

  return (
    <span className={`${base} shrink-0 ${tone}`}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function GradYearBadge({ year }: { year: number }) {
  const level = levelForYear(year);
  return (
    <span className={`${base} bg-accent-soft text-accent`}>
      Class of {year}
      {level && <span className="font-normal opacity-75">· {level}</span>}
    </span>
  );
}

export const TYPE_LABELS: Record<OpportunityType, string> = {
  internship: "Internship",
  program: "Early-career program",
  fellowship: "Fellowship",
  hackathon: "Hackathon",
  research: "Research",
};

export function TypeBadge({ type }: { type: OpportunityType }) {
  return <span className={`${base} border border-line text-muted`}>{TYPE_LABELS[type]}</span>;
}
