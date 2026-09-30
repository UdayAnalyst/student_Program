"use client";

import { useCountUp } from "@/lib/useCountUp";
import { CLASS_LEVELS, type Opportunity } from "@/lib/types";

type Props = {
  opportunities: Opportunity[]; // open only, sorted by deadline
  onGetAlerts: () => void;
};

// Editorial hero: a centered two-line tagline, a black film-grain "poster" with giant type,
// and a caption row underneath. Motion: the headline lines rise in from a mask, the grain
// flickers, a shaft of light sweeps, a spotlight follows the cursor, and the stats count up.
export function Hero({ opportunities, onGetAlerts }: Props) {
  const total = useCountUp(opportunities.length, 1400, 1000);
  const accepting = useCountUp(opportunities.filter((o) => o.accepting).length, 1400, 1100);
  const freshman = useCountUp(
    opportunities.filter((o) => o.gradYears.includes(CLASS_LEVELS.freshman)).length,
    1400,
    1200,
  );
  const sophomore = useCountUp(
    opportunities.filter((o) => o.gradYears.includes(CLASS_LEVELS.sophomore)).length,
    1400,
    1300,
  );
  const companies = useCountUp(new Set(opportunities.map((o) => o.company)).size, 1400, 1400);

  function trackSpotlight(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-24">
      <p className="animate-fade-up text-center text-lg leading-snug sm:text-xl">
        <span className="font-medium">Tech opportunities built for</span>
        <br />
        <span className="font-serif font-light italic">freshmen &amp; sophomores</span>
      </p>

      <div
        onMouseMove={trackSpotlight}
        style={{ animationDelay: "120ms" }}
        className="group animate-fade-up relative mt-12 overflow-hidden rounded-md bg-[#0a0a0a] text-white sm:mt-20"
      >
        {/* flickering film grain */}
        <div
          aria-hidden
          className="grain animate-grain pointer-events-none absolute -inset-[10%] opacity-35 mix-blend-screen"
        />
        {/* a slow-sweeping diagonal shaft of light */}
        <div
          aria-hidden
          className="animate-sweep pointer-events-none absolute inset-y-0 -inset-x-1/4 bg-[linear-gradient(118deg,transparent_48%,rgba(255,255,255,0.07)_48%,rgba(255,255,255,0.07)_64%,transparent_64%)]"
        />
        {/* spotlight that follows the cursor */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(520px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.11), transparent 60%)",
          }}
        />

        <div className="relative flex min-h-[520px] flex-col justify-between gap-10 p-5 sm:min-h-[640px] sm:p-8">
          <div
            style={{ animationDelay: "300ms" }}
            className="animate-fade-down flex justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60"
          >
            <span>Launchpad</span>
            <span>Class of 2029 &amp; 2030</span>
          </div>

          <h1
            aria-label="You're not too early."
            className="font-display text-[clamp(3.6rem,13.5vw,11rem)] font-black leading-[0.82] tracking-[-0.055em] [word-spacing:0.1em]"
          >
            <MaskedLine delay={350}>You&apos;re not</MaskedLine>
            <MaskedLine delay={520}>
              too early
              <span aria-hidden style={{ animationDelay: "1150ms" }} className="animate-pop-in inline-block">
                .
              </span>
            </MaskedLine>
          </h1>

          <div
            style={{ animationDelay: "850ms" }}
            className="animate-fade-up flex flex-wrap items-end justify-between gap-6"
          >
            <p className="max-w-md font-serif text-lg font-light leading-snug text-white/80 sm:text-xl">
              Stop scrolling past &ldquo;juniors and seniors only.&rdquo; Every program here takes first- and
              second-year students, and we checked each one by hand.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onGetAlerts}
                className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition hover:-translate-y-0.5 hover:bg-white/90"
              >
                Get text alerts
              </button>
              <a
                href="#feed"
                className="group/explore inline-flex items-center gap-3 rounded-md border border-white/25 px-4 py-2.5 text-sm transition hover:bg-white/10"
              >
                Explore
                <span
                  aria-hidden
                  className="transition-transform duration-300 group-hover/explore:-translate-y-0.5 group-hover/explore:translate-x-0.5"
                >
                  ↗
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{ animationDelay: "1000ms" }}
        className="animate-fade-up mt-3 flex items-baseline justify-between gap-6 text-sm"
      >
        <p>
          <span className="font-semibold tabular-nums">{total} programs</span>{" "}
          <span className="font-serif text-[15px] tabular-nums text-ink/80">
            {accepting} accepting now · {freshman} for freshmen · {sophomore} for sophomores · {companies} companies.
          </span>
        </p>
        <span className="font-mono text-xs text-muted">01</span>
      </div>
    </section>
  );
}

// One headline line that slides up from behind a mask.
function MaskedLine({ children, delay }: { children: React.ReactNode; delay: number }) {
  return (
    <span aria-hidden className="block overflow-hidden pb-[0.08em] pt-[0.04em]">
      <span className="animate-rise block" style={{ animationDelay: `${delay}ms` }}>
        {children}
      </span>
    </span>
  );
}
