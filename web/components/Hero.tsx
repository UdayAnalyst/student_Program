import { daysUntil, formatDate } from "@/lib/dates";
import { CLASS_LEVELS, type Opportunity } from "@/lib/types";
import { PhonePreview, type SmsMessage } from "./PhonePreview";

type Props = {
  opportunities: Opportunity[]; // open only, sorted by deadline
  onGetAlerts: () => void;
};

export function Hero({ opportunities, onGetAlerts }: Props) {
  const freshman = opportunities.filter((o) => o.gradYears.includes(CLASS_LEVELS.freshman));
  const sophomore = opportunities.filter((o) => o.gradYears.includes(CLASS_LEVELS.sophomore));
  const closingSoon = opportunities.filter((o) => o.deadline && daysUntil(o.deadline) <= 7);

  const first = freshman[0];
  const remote = freshman.find((o) => o.remote);
  const messages: SmsMessage[] = [];
  if (first)
    messages.push({
      from: "agent",
      text: `New for Class of 2030: ${first.title} at ${first.company}${
        first.deadline ? `, closes ${formatDate(first.deadline)}` : ""
      }. Apply → link`,
    });
  messages.push({ from: "me", text: "anything remote?" });
  messages.push({
    from: "agent",
    text: remote ? `Yes: ${remote.title} (${remote.company}) is fully remote.` : "Nothing remote right now. I'll text you when one opens.",
  });

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-ok" />
            Recruiting season is open · {opportunities.length} opportunities live
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Tech opportunities
            <br />
            built for <span className="text-accent">underclassmen.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Stop scrolling past &ldquo;juniors and seniors only.&rdquo; Every listing here is checked for Class of 2029
            and 2030 eligibility, with deadlines front and center.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#feed"
              className="inline-flex h-12 items-center rounded-xl bg-ink px-6 font-semibold text-bg transition hover:opacity-90"
            >
              Browse opportunities
            </a>
            <button
              onClick={onGetAlerts}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-6 font-semibold transition hover:border-accent hover:text-accent"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinejoin="round" d="M4 5h16v11H9l-5 4V5Z" />
              </svg>
              Get text alerts
            </button>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            <Stat value={freshman.length} label="for freshmen" />
            <Stat value={sophomore.length} label="for sophomores" />
            <Stat value={closingSoon.length} label="closing this week" accent />
          </dl>
        </div>

        <PhonePreview messages={messages} className="hidden lg:block" />
      </div>
    </section>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-0.5 text-sm text-muted">{label}</dt>
      <dd className={`text-3xl font-semibold tabular-nums ${accent ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}
