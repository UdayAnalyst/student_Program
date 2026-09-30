// Deterministic colored initial, so cards look distinct without logos.
// Lightness comes from CSS vars so it adapts to dark mode (see globals.css).
const HUES = [262, 200, 150, 28, 340, 180, 45, 300];

export function CompanyAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  const hue = HUES[hash % HUES.length];
  const dims = size === "lg" ? "size-12 text-lg" : "size-10 text-base";
  return (
    <span
      aria-hidden
      className={`${dims} grid shrink-0 place-items-center rounded-xl font-semibold`}
      style={{
        background: `oklch(var(--avatar-bg-l) 0.06 ${hue})`,
        color: `oklch(var(--avatar-fg-l) 0.15 ${hue})`,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}
