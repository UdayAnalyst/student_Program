import { promises as fs } from "node:fs";
import path from "node:path";
import type { Subscriber } from "./types";

// Local JSON file store, fine for a hackathon demo on one machine.
// .data/ is gitignored so phone numbers never get committed.
// For a deployed site, swap these three functions for a real database.
const FILE = path.join(process.cwd(), ".data", "subscribers.json");

export async function listSubscribers(): Promise<Subscriber[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Subscriber[];
  } catch {
    return [];
  }
}

async function saveAll(list: Subscriber[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}

export async function upsertSubscriber(sub: Omit<Subscriber, "sentIds" | "createdAt">) {
  const list = await listSubscribers();
  const existing = list.find((s) => s.phone === sub.phone);
  const next: Subscriber = existing
    ? { ...existing, levels: sub.levels, types: sub.types }
    : { ...sub, sentIds: [], createdAt: new Date().toISOString() };
  await saveAll([...list.filter((s) => s.phone !== sub.phone), next]);
  return next;
}

export async function markSent(phone: string, ids: string[]) {
  const list = await listSubscribers();
  await saveAll(
    list.map((s) => (s.phone === phone ? { ...s, sentIds: [...new Set([...s.sentIds, ...ids])] } : s)),
  );
}
