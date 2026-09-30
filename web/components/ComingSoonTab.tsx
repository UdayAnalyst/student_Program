"use client";

import { useEffect, useState } from "react";

// A blacked-out class-year tab (juniors/seniors) that isn't supported yet.
// Hover, keyboard focus, or a tap (phones can't hover) swaps the label for "Coming soon! :)".
export const LOCKED_YEARS = [
  { label: "Junior", sub: "Class of 2028" },
  { label: "Senior", sub: "Class of 2027" },
];

export function ComingSoonTab({ label, sub, className = "" }: { label: string; sub: string; className?: string }) {
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    if (!tapped) return;
    const t = setTimeout(() => setTapped(false), 1600);
    return () => clearTimeout(t);
  }, [tapped]);

  return (
    <button
      type="button"
      aria-disabled
      aria-label={`${label}: coming soon`}
      onClick={(e) => {
        e.preventDefault();
        setTapped(true);
      }}
      className={`group relative cursor-not-allowed overflow-hidden bg-neutral-950 text-left text-neutral-500 ring-1 ring-inset ring-white/5 focus-visible:outline-none ${className}`}
    >
      <span
        className={`block transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 ${
          tapped ? "opacity-0" : ""
        }`}
      >
        <span className="block font-semibold leading-tight">{label}</span>
        <span className="block text-[11px] leading-tight text-neutral-600">{sub}</span>
      </span>
      <span
        aria-hidden
        className={`absolute inset-0 grid place-items-center text-sm font-semibold text-white transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          tapped ? "opacity-100" : "opacity-0"
        }`}
      >
        Coming soon! :)
      </span>
    </button>
  );
}
