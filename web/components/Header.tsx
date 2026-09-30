"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "@/lib/useSaved";

// Floating pill nav: a serif monogram plus small numbered tabs.
export function Header() {
  const pathname = usePathname();
  const { count } = useSaved();

  // `count`: shown next to the label (only the Saved tab uses it).
  const tab = (href: string, label: string, count?: number) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm transition ${
          active ? "bg-ink text-bg" : "bg-subtle text-ink hover:bg-line"
        }`}
      >
        {label}
        {count !== undefined && (
          <sup className="ml-1 text-[10px] font-medium opacity-60" aria-label={`${count} saved`}>
            {count}
          </sup>
        )}
      </Link>
    );
  };

  return (
    <header className="pointer-events-none sticky top-3 z-40 flex h-12 justify-center px-4">
      <nav className="animate-fade-down pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-bg/85 p-1 shadow-[0_1px_12px_rgba(0,0,0,0.06)] backdrop-blur-md">
        <Link
          href="/"
          aria-label="Launchpad home"
          className="grid size-8 place-items-center font-serif text-2xl italic leading-none"
        >
          L
        </Link>
        {tab("/", "Explore")}
        {tab("/saved", "Saved", count)}
        <Link
          href="/#feed"
          className="inline-flex items-center rounded-md bg-subtle px-3 py-1.5 text-sm text-ink transition hover:bg-line"
        >
          Programs
        </Link>
      </nav>
    </header>
  );
}
