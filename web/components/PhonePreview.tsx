export type SmsMessage = { from: "agent" | "me"; text: string };

// Makes URLs in a text message tappable, like a real phone does.
function Linkified({ text }: { text: string }) {
  return text.split(/(https?:\/\/\S+)/).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} className="break-all underline underline-offset-2 hover:opacity-70">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

// Decorative phone mockup showing what an alert thread looks like.
export function PhonePreview({ messages, className = "" }: { messages: SmsMessage[]; className?: string }) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border border-line bg-surface p-3 shadow-2xl shadow-accent/10 ${className}`}
    >
      <div className="rounded-[2rem] bg-bg px-4 pb-6 pt-3">
        <div className="mx-auto mb-4 h-5 w-24 rounded-full bg-ink/90" aria-hidden />
        <div className="mb-4 flex flex-col items-center gap-1">
          <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent">LP</span>
          <span className="text-xs font-medium">Launchpad Alerts</span>
        </div>
        <ol className="flex flex-col gap-2 text-left text-[13px] leading-snug" aria-label="Sample text messages">
          {messages.map((m, i) => (
            <li
              key={i}
              style={{ animationDelay: `${300 + i * 450}ms` }}
              className={`animate-bubble max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3 py-2 ${
                m.from === "agent"
                  ? "self-start rounded-bl-md bg-subtle"
                  : "self-end rounded-br-md bg-accent text-on-accent"
              }`}
            >
              <Linkified text={m.text} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
