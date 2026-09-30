import { alertText, matchesFor, siteUrl } from "@/lib/alerts";
import { sendSms } from "@/lib/sms";
import { listSubscribers, markSent } from "@/lib/subscribers";

type Result = { phone: string; message: string | null; dryRun: boolean };

// POST { phone } → text that subscriber any new matching opportunities.
// POST {} → run the agent for every subscriber (e.g. from a cron job or a demo button).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const all = await listSubscribers();
  const targets = body.phone ? all.filter((s) => s.phone === body.phone) : all;

  if (body.phone && targets.length === 0) {
    return Response.json({ ok: false, error: "That number isn't subscribed." }, { status: 404 });
  }

  const results: Result[] = [];
  for (const sub of targets) {
    const matches = matchesFor(sub);
    if (matches.length === 0) {
      results.push({ phone: sub.phone, message: null, dryRun: true });
      continue;
    }
    const message = alertText(sub, matches, siteUrl(request));
    try {
      const { dryRun } = await sendSms(sub.phone, message);
      await markSent(sub.phone, matches.slice(0, 3).map((o) => o.id));
      results.push({ phone: sub.phone, message, dryRun });
    } catch (err) {
      return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
    }
  }

  // Single-subscriber calls (the modal's button) get a flat response.
  if (body.phone) {
    const [r] = results;
    return Response.json({ ok: true, dryRun: r.dryRun, message: r.message });
  }
  return Response.json({ ok: true, sent: results.filter((r) => r.message).length, results });
}
