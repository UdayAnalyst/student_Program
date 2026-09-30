import { alertText, matchesFor, siteUrl } from "@/lib/alerts";
import { sendSms } from "@/lib/sms";
import { listSubscribers, markSent } from "@/lib/subscribers";
import { CLASS_LEVELS, OPPORTUNITY_TYPES, type ClassLevel, type OpportunityType, type Subscriber } from "@/lib/types";

type Result = { phone: string; message: string | null; dryRun: boolean; ids: string[] };

const isLevel = (v: unknown): v is ClassLevel => typeof v === "string" && v in CLASS_LEVELS;
const isType = (v: unknown): v is OpportunityType =>
  typeof v === "string" && (OPPORTUNITY_TYPES as readonly string[]).includes(v);
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// POST { phone, levels?, types?, sentIds? } → text that subscriber any new matching opportunities.
//   The modal sends its own copy of the profile and what it has already shown, so this works
//   even where the server couldn't save the subscriber (e.g. Vercel's read-only filesystem).
// POST {} → run the agent for every saved subscriber (e.g. from a cron job).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    phone?: unknown;
    levels?: unknown;
    types?: unknown;
    sentIds?: unknown;
  };
  const phone = typeof body.phone === "string" ? body.phone : undefined;
  const all = await listSubscribers();

  let targets: Subscriber[];
  if (phone) {
    const stored = all.find((s) => s.phone === phone);
    const levels = Array.isArray(body.levels) ? body.levels.filter(isLevel) : [];
    const types = Array.isArray(body.types) ? body.types.filter(isType) : [];
    const fromRequest: Subscriber | undefined = levels.length
      ? { phone, levels, types, sentIds: [], createdAt: new Date().toISOString() }
      : undefined;
    const profile = stored ?? fromRequest;
    if (!profile) {
      return Response.json({ ok: false, error: "That number isn't subscribed." }, { status: 404 });
    }
    targets = [{ ...profile, sentIds: [...new Set([...profile.sentIds, ...strings(body.sentIds)])] }];
  } else {
    targets = all;
  }

  const results: Result[] = [];
  for (const sub of targets) {
    const matches = matchesFor(sub);
    if (matches.length === 0) {
      results.push({ phone: sub.phone, message: null, dryRun: true, ids: [] });
      continue;
    }
    const message = alertText(sub, matches, siteUrl(request));
    const ids = matches.slice(0, 3).map((o) => o.id);
    try {
      const { dryRun } = await sendSms(sub.phone, message);
      await markSent(sub.phone, ids);
      results.push({ phone: sub.phone, message, dryRun, ids });
    } catch (err) {
      return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
    }
  }

  // Single-subscriber calls (the modal's button) get a flat response.
  if (phone) {
    const [r] = results;
    return Response.json({ ok: true, dryRun: r.dryRun, message: r.message, ids: r.ids });
  }
  return Response.json({ ok: true, sent: results.filter((r) => r.message).length, results });
}
