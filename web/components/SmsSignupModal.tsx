"use client";

import { useEffect, useState } from "react";
import { toggle } from "@/lib/filters";
import { CLASS_LEVELS, OPPORTUNITY_TYPES, type ClassLevel, type OpportunityType } from "@/lib/types";
import { TYPE_LABELS } from "./Badges";
import { PhonePreview } from "./PhonePreview";

type Props = { onClose: () => void };

async function post<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Server error" }));
  if (!data.ok) throw new Error(data.error ?? "Something went wrong");
  return data as T;
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function SmsSignupModal({ onClose }: Props) {
  const [phone, setPhone] = useState("");
  const [levels, setLevels] = useState<ClassLevel[]>(["freshman"]);
  const [types, setTypes] = useState<OpportunityType[]>([]);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [texts, setTexts] = useState<string[]>([]); // messages the agent sent this number
  const [dryRun, setDryRun] = useState(true);
  const [alerting, setAlerting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const digits = phone.replace(/\D/g, "");
  const valid = digits.length === 10 && levels.length > 0 && consent;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setState("sending");
    setError(null);
    try {
      const data = await post<{ dryRun: boolean; messages: string[] }>("/api/subscribe", {
        phone: `+1${digits}`,
        levels,
        types,
      });
      setTexts(data.messages);
      setDryRun(data.dryRun);
      setState("done");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  // Runs the agent for this number right away (demo button; normally a scheduled job).
  async function sendFirstAlert() {
    setAlerting(true);
    setError(null);
    try {
      const data = await post<{ dryRun: boolean; message: string | null }>("/api/notify", {
        phone: `+1${digits}`,
      });
      setTexts((t) => [...t, data.message ?? "You're all caught up. We'll text you when something new opens."]);
      setDryRun(data.dryRun);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAlerting(false);
    }
  }

  const classLabel = levels.map((l) => `Class of ${CLASS_LEVELS[l]}`).join(" & ");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-labelledby="sms-title">
      <button aria-label="Close" onClick={onClose} className="animate-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div className="animate-pop relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl sm:p-8">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink"
        >
          ✕
        </button>

        {state === "done" ? (
          <div className="text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-ok-soft text-xl text-ok">✓</div>
            <h2 id="sms-title" className="mt-4 text-xl font-semibold">You&apos;re subscribed</h2>
            <p className="mt-1 text-sm text-muted">
              We&apos;ll text <span className="font-medium text-ink">{phone}</span> when new {classLabel} opportunities open.
            </p>
            {dryRun && texts.length > 1 && (
              <p className="mx-auto mt-3 w-fit rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn">
                Demo mode: texts appear here instead of being sent
              </p>
            )}
            <PhonePreview className="mt-5" messages={texts.map((text) => ({ from: "agent", text }))} />
            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            <button
              onClick={sendFirstAlert}
              disabled={alerting}
              className="mt-6 h-11 w-full rounded-xl bg-accent font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-50"
            >
              {alerting ? "Finding matches…" : texts.length > 1 ? "Check for more" : "Send my first alert now"}
            </button>
            <button onClick={onClose} className="mt-2 h-11 w-full rounded-xl border border-line font-semibold">
              Back to opportunities
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">SMS alerts</p>
            <h2 id="sms-title" className="mt-1 text-2xl font-semibold tracking-tight">
              Never miss a deadline
            </h2>
            <p className="mt-2 text-sm text-muted">
              Our agent watches for new openings and texts you only the ones you&apos;re eligible for.
            </p>

            <label className="mt-6 block text-sm font-medium" htmlFor="phone">
              Phone number
            </label>
            <div className="mt-2 flex h-12 items-center rounded-xl border border-line bg-bg px-4 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
              <span className="mr-2 text-muted">+1</span>
              <input
                id="phone"
                autoFocus
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                className="h-full flex-1 bg-transparent outline-none placeholder:text-muted"
              />
            </div>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium">I&apos;m a…</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(CLASS_LEVELS) as ClassLevel[]).map((l) => {
                  const active = levels.includes(l);
                  return (
                    <button
                      type="button"
                      key={l}
                      aria-pressed={active}
                      onClick={() => setLevels(toggle(levels, l))}
                      className={`rounded-xl border p-3 text-left transition ${
                        active ? "border-accent bg-accent-soft" : "border-line hover:border-ink/30"
                      }`}
                    >
                      <span className="block font-semibold capitalize">{l}</span>
                      <span className="block text-xs text-muted">Class of {CLASS_LEVELS[l]}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium">
                Interested in <span className="font-normal text-muted">(optional, blank = everything)</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {OPPORTUNITY_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={types.includes(t)}
                    onClick={() => setTypes(toggle(types, t))}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      types.includes(t) ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="mt-6 flex items-start gap-3 text-xs leading-relaxed text-muted">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              I agree to receive recurring text alerts from Launchpad. Msg &amp; data rates may apply. Reply STOP to
              unsubscribe, HELP for help.
            </label>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={!valid || state === "sending"}
              className="mt-6 h-12 w-full rounded-xl bg-accent font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {state === "sending" ? "Subscribing…" : "Text me opportunities"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
