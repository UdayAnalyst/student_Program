"use client";

import { useState } from "react";

// Company logo when we have one, otherwise a deterministic colored initial.
// Lightness comes from CSS vars so the initial adapts to dark mode (see globals.css).
const HUES = [262, 200, 150, 28, 340, 180, 45, 300];

type Props = { name: string; logo?: string; size?: "md" | "lg" };

export function CompanyAvatar({ name, logo, size = "md" }: Props) {
  const [failed, setFailed] = useState(false);
  const dims = size === "lg" ? "size-12 text-lg" : "size-10 text-base";

  if (logo && !failed) {
    return (
      <span aria-hidden className={`${dims} grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-line`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote favicon, no optimization needed */}
        <img
          src={logo}
          alt=""
          loading="lazy"
          className="size-full object-contain"
          // The favicon service returns a tiny generic globe when it has no logo: treat that as
          // missing. The ref covers images that finished loading before React hydrated.
          ref={(img) => {
            if (img?.complete && img.naturalWidth < 32) setFailed(true);
          }}
          onLoad={(e) => e.currentTarget.naturalWidth < 32 && setFailed(true)}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  const hash = [...name].reduce((h, c) => h + c.charCodeAt(0), 0);
  const hue = HUES[hash % HUES.length];
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
