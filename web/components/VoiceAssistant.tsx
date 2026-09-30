"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AdvisorMatch, AdvisorResult } from "@/lib/assistant";
import { formatDate } from "@/lib/dates";
import type { Opportunity } from "@/lib/types";
import { DeadlineBadge } from "./Badges";
import { CompanyAvatar } from "./CompanyAvatar";
import { NotifyButton } from "./OpportunityCard";
import { Reveal } from "./Reveal";

// Minimal typing for the browser's Web Speech API (Chrome, Edge, Safari; not Firefox).
type SpeechResultList = ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
const noopSubscribe = () => () => {};

const EXAMPLES = [
  "I'm a freshman into AI and want something paid",
  "Sophomore who likes trading and math, open now",
  "Anything for women in tech?",
];

type Props = {
  opportunities: Opportunity[];
  onOpenProgram: (id: string) => void;
  onNotify: (o: Opportunity) => void;
  isWatching: (id: string) => boolean;
};

// Talk (or type) what you're looking for; the advisor (Claude, via /api/assistant) suggests
// programs, summarizes each, and walks you to applying for the one you pick.
export function VoiceAssistant({ opportunities, onOpenProgram, onNotify, isWatching }: Props) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  // Assume support during server render; the browser answers for real after hydration.
  const supported = useSyncExternalStore(noopSubscribe, () => Boolean(recognizerCtor()), () => true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [speakOn, setSpeakOn] = useState(true);
  const [voice, setVoice] = useState<"elevenlabs" | "browser" | null>(null); // which voice spoke last
  const recognizer = useRef<Recognizer | null>(null);
  const heard = useRef("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const speakSeq = useRef(0);

  useEffect(() => {
    return () => {
      recognizer.current?.stop();
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Stops whatever is being read aloud (ElevenLabs audio or the browser voice).
  function stopSpeaking() {
    speakSeq.current++;
    audio.current?.pause();
    audio.current = null;
    window.speechSynthesis?.cancel();
  }

  // Reads text aloud with the ElevenLabs voice (via /api/tts, so the API key stays on the
  // server). Falls back to the browser's built-in voice if ElevenLabs isn't set up or fails.
  async function speak(text: string) {
    stopSpeaking();
    if (!speakOn) return;
    const seq = speakSeq.current; // a newer speak()/stop wins over audio still loading
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        const url = URL.createObjectURL(await res.blob());
        if (seq !== speakSeq.current) return URL.revokeObjectURL(url);
        const a = new Audio(url);
        a.onended = () => URL.revokeObjectURL(url);
        audio.current = a;
        await a.play();
        setVoice("elevenlabs");
        return;
      }
    } catch {
      // network error or autoplay blocked: use the browser voice below
    }
    if (seq !== speakSeq.current || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    window.speechSynthesis.speak(u);
    setVoice("browser");
  }

  async function ask(text: string) {
    const q = text.trim();
    if (q.length < 3 || loading) return;
    setLoading(true);
    setError(null);
    setFocusId(null);
    stopSpeaking();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as ({ ok: true } & AdvisorResult) | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      speak(`${data.reply} ${data.followUp}`);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recognizer.current?.stop();
      return;
    }
    const Ctor = recognizerCtor();
    if (!Ctor) return;

    stopSpeaking();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    heard.current = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      heard.current = text;
      setQuery(text);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked. Allow it in your browser, or type instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Didn't catch that. Try again or type instead.");
    };
    rec.onend = () => {
      setListening(false);
      if (heard.current.trim().length >= 3) ask(heard.current); // voice-first: submit when you stop talking
    };
    recognizer.current = rec;
    setError(null);
    setQuery("");
    setListening(true);
    rec.start();
  }

  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const matches = (result?.matches ?? []).filter((m) => byId.has(m.id));
  const focused = matches.find((m) => m.id === focusId);

  function focus(m: AdvisorMatch) {
    setFocusId(m.id);
    const o = byId.get(m.id)!;
    speak(`${o.title} at ${o.company}. ${m.programSummary} Would you like to continue to apply for this position?`);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <Reveal className="mt-24 flex items-end justify-between gap-4 pb-6">
        <h2 className="font-serif text-4xl font-light leading-none tracking-tight sm:text-6xl">
          Tell us what you&apos;re looking for<span className="italic text-muted">.</span>
        </h2>
        <span className="font-mono text-xs text-muted">02</span>
      </Reveal>

      <Reveal className="rounded-md border border-line bg-surface p-5 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Mic */}
          <div className="flex flex-col items-center gap-2 sm:w-40">
            <button
              onClick={toggleMic}
              disabled={!supported || loading}
              aria-pressed={listening}
              aria-label={listening ? "Stop recording" : "Start recording"}
              className="relative grid size-24 place-items-center rounded-full bg-ink text-bg transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-ink/40" />}
              <MicIcon className="relative size-9" />
            </button>
            <p className="text-center text-xs text-muted" aria-live="polite">
              {!supported ? "Voice isn't supported in this browser. Type instead." : listening ? "Listening… tap to stop" : "Tap to talk"}
            </p>
          </div>

          {/* Text + examples */}
          <form
            className="flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              ask(query);
            }}
          >
            <label htmlFor="assistant-query" className="text-sm font-medium">
              Your interests, class year, and what you want out of a program
            </label>
            <textarea
              id="assistant-query"
              rows={3}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={600}
              placeholder="e.g. I'm a freshman studying CS. I like AI and want a paid summer program."
              className="mt-2 w-full resize-none rounded-md border border-line bg-bg p-3 font-serif text-lg leading-snug outline-none transition placeholder:text-muted focus:border-ink"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={query.trim().length < 3 || loading}
                className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-40"
              >
                {loading ? "Finding programs…" : "Find my programs"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpeakOn((s) => !s);
                  stopSpeaking();
                }}
                aria-pressed={speakOn}
                className="rounded-md border border-line px-3 py-2.5 text-sm transition hover:border-ink"
              >
                {speakOn ? `🔊 Read answers aloud${voice === "elevenlabs" ? " · ElevenLabs voice" : ""}` : "🔇 Muted"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setQuery(ex);
                    ask(ex);
                  }}
                  className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted transition hover:border-ink hover:text-ink"
                >
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </form>
        </div>

        {/* Answer */}
        {result && !focused && (
          <div className="animate-fade-up mt-8 border-t border-line pt-6">
            <p className="font-serif text-2xl font-light leading-snug">{result.reply}</p>
            {matches.length > 0 && <p className="mt-2 text-sm text-muted">{result.followUp}</p>}
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {matches.map((m, i) => {
                const o = byId.get(m.id)!;
                return (
                  <button
                    key={m.id}
                    onClick={() => focus(m)}
                    className="group flex flex-col gap-3 rounded-md border border-line p-4 text-left transition hover:-translate-y-0.5 hover:border-ink"
                  >
                    <span className="flex items-center gap-3">
                      <CompanyAvatar name={o.company} logo={o.logo} />
                      <span className="min-w-0">
                        <span className="block text-xs text-muted">
                          <span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {o.company}
                        </span>
                        <span className="block font-serif text-lg leading-tight">{o.title}</span>
                      </span>
                    </span>
                    <span className="text-sm leading-snug">{m.why}</span>
                    <span className="mt-auto flex items-center justify-between gap-2">
                      <DeadlineBadge deadline={o.deadline} status={o.statusLabel} />
                      <span className="text-sm font-medium transition group-hover:translate-x-0.5">Focus on this →</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {result.source === "keywords" && (
              <p className="mt-4 text-xs text-muted">Matched by keywords. Add an Anthropic API key for smarter, AI-written matches.</p>
            )}
          </div>
        )}

        {/* Focused program: summary + "continue to apply?" */}
        {focused &&
          (() => {
            const o = byId.get(focused.id)!;
            return (
              <div className="animate-fade-up mt-8 border-t border-line pt-6">
                <button onClick={() => setFocusId(null)} className="text-sm text-muted hover:text-ink">
                  ← Back to your matches
                </button>
                <div className="mt-4 flex items-center gap-4">
                  <CompanyAvatar name={o.company} logo={o.logo} size="lg" />
                  <div>
                    <p className="text-sm text-muted">
                      {o.company}
                      {o.companyFocus && ` · ${o.companyFocus}`}
                    </p>
                    <h3 className="font-serif text-3xl font-light leading-tight">{o.title}</h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">What the company does</h4>
                    <p className="mt-2 leading-relaxed">{focused.companySummary}</p>
                    <h4 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">The program</h4>
                    <p className="mt-2 leading-relaxed">{focused.programSummary}</p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">What they look for</h4>
                    <ul className="mt-2 space-y-1.5">
                      {focused.lookingFor.map((item) => (
                        <li key={item} className="flex gap-2 leading-snug">
                          <span aria-hidden>✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted">
                      {o.accepting
                        ? `Accepting applications now${o.deadline ? `, apply by ${formatDate(o.deadline)}` : ""}.`
                        : `Not accepting applications yet${o.applyWindow ? `. ${o.applyWindow}` : ""}.`}
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-md bg-subtle p-5">
                  <p className="font-serif text-xl">Would you like to continue to apply for this position?</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {o.accepting ? (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition hover:opacity-90"
                      >
                        Yes, continue to apply <span aria-hidden>↗</span>
                      </a>
                    ) : (
                      <NotifyButton
                        watching={isWatching(o.id)}
                        onClick={() => onNotify(o)}
                        className="h-10 px-4 text-sm"
                      />
                    )}
                    <button
                      onClick={() => onOpenProgram(o.id)}
                      className="rounded-md border border-line px-4 py-2.5 text-sm transition hover:border-ink"
                    >
                      See full details
                    </button>
                    <button
                      onClick={() => setFocusId(null)}
                      className="rounded-md px-4 py-2.5 text-sm text-muted transition hover:text-ink"
                    >
                      No, show my other matches
                    </button>
                  </div>
                  {!o.accepting && (
                    <p className="mt-3 text-xs text-muted">
                      It isn&apos;t open yet, so we&apos;ll text you the moment applications open.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
      </Reveal>
    </section>
  );
}

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}
