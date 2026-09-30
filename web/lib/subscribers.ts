import { promises as fs } from "node:fs";
import path from "node:path";
import type { Subscriber } from "./types";

// JSON file store, fine for a hackathon demo. Locally it lives in .data/ (gitignored so
// phone numbers never get committed). Vercel's filesystem is read-only except /tmp, and
// /tmp isn't shared between server instances, so saving is best-effort there: the demo
// sends everything it needs with each request instead of relying on this store.
// For real alerts in production, swap these functions for a database (e.g. Upstash Redis).
const FILE = process.env.VERCEL
  ? path.join("/tmp", "launchpad-subscribers.json")
  : path.join(process.cwd(), ".data", "subscribers.json");

export async function listSubscribers(): Promise<Subscriber[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Subscriber[];
  } catch {
    return [];
  }
}

async function saveAll(list: Subscriber[]) {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    // Don't break sign-ups when the host can't write files.
    console.warn(`[subscribers] could not save (${(err as Error).message})`);
  }
}

export async function upsertSubscriber(sub: Omit<Subscriber, "sentIds" | "createdAt">) {
  const list = await listSubscribers();
  const existing = list.find((s) => s.phone === sub.phone);
  const watchIds = [...new Set([...(existing?.watchIds ?? []), ...(sub.watchIds ?? [])])];
  const next: Subscriber = existing
    ? { ...existing, levels: sub.levels, types: sub.types, watchIds }
    : { ...sub, watchIds, sentIds: [], createdAt: new Date().toISOString() };
  await saveAll([...list.filter((s) => s.phone !== sub.phone), next]);
  return next;
}

export async function markSent(phone: string, ids: string[]) {
  const list = await listSubscribers();
  await saveAll(
    list.map((s) => (s.phone === phone ? { ...s, sentIds: [...new Set([...s.sentIds, ...ids])] } : s)),
  );
}
