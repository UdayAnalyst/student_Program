"use client";

import { useSyncExternalStore } from "react";

// Saved/applied tracker, persisted per-browser in localStorage.
export type SavedStatus = "saved" | "applied";
type SavedMap = Record<string, SavedStatus>;

const KEY = "launchpad:saved";
const EMPTY: SavedMap = {};
const listeners = new Set<() => void>();
let cache: SavedMap | null = null;

function read(): SavedMap {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as SavedMap;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: SavedMap) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage blocked (private mode): keep it in memory only
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSaved() {
  const saved = useSyncExternalStore(subscribe, read, () => EMPTY);

  return {
    saved,
    count: Object.keys(saved).length,
    setStatus(id: string, status: SavedStatus | null) {
      const next = { ...read() };
      if (status) next[id] = status;
      else delete next[id];
      write(next);
    },
    toggleSaved(id: string) {
      const next = { ...read() };
      if (next[id]) delete next[id];
      else next[id] = "saved";
      write(next);
    },
  };
}
