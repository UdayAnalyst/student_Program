"use client";

import { useSyncExternalStore } from "react";

// Programs this browser asked to be notified about (the 🔔 Notify me button).
// The server keeps the real subscription; this just remembers the button state.
const KEY = "launchpad:watching";
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    cache = [];
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useWatchlist() {
  const watching = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    isWatching: (id: string) => watching.includes(id),
    watch(id: string) {
      if (read().includes(id)) return;
      cache = [...read(), id];
      try {
        localStorage.setItem(KEY, JSON.stringify(cache));
      } catch {
        // storage blocked: keep in memory only
      }
      listeners.forEach((l) => l());
    },
  };
}
