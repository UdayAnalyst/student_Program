// A blacked-out class-year tab (juniors/seniors) that isn't supported yet.
// Hover or keyboard focus swaps the label for "Coming soon! :)".
export const LOCKED_YEARS = [
  { label: "Junior", sub: "Class of 2028" },
  { label: "Senior", sub: "Class of 2027" },
];

export function ComingSoonTab({ label, sub, className = "" }: { label: string; sub: string; className?: string }) {
  return (
    <button
      type="button"
      aria-disabled
      aria-label={`${label}: coming soon`}
      onClick={(e) => e.preventDefault()}
      className={`group relative cursor-not-allowed overflow-hidden bg-neutral-950 text-left text-neutral-500 ring-1 ring-inset ring-white/5 focus-visible:outline-none ${className}`}
    >
      <span className="block transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0">
        <span className="block font-semibold leading-tight">{label}</span>
        <span className="block text-[11px] leading-tight text-neutral-600">{sub}</span>
      </span>
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center text-sm font-semibold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Coming soon! :)
      </span>
    </button>
  );
}
