"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSaved } from "@/lib/useSaved";

export function Header() {
  const pathname = usePathname();
  const { count } = useSaved();

  const link = (href: string, label: React.ReactNode) => (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        pathname === href ? "bg-subtle text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c3 2 5 5.5 5 9.5L15 17H9l-2-4.5C7 8.5 9 5 12 3Z" />
              <path strokeLinecap="round" d="M9.5 20.5h5M12 9.5v1" />
            </svg>
          </span>
          Launchpad
        </Link>
        <nav className="flex items-center gap-1">
          {link("/", "Explore")}
          {link(
            "/saved",
            <>
              Saved
              {count > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-on-accent">
                  {count}
                </span>
              )}
            </>,
          )}
        </nav>
      </div>
    </header>
  );
}
