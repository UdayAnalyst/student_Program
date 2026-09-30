import { welcomeText } from "@/lib/alerts";
import { sendSms } from "@/lib/sms";
import { upsertSubscriber } from "@/lib/subscribers";
import { CLASS_LEVELS, OPPORTUNITY_TYPES, type ClassLevel, type OpportunityType } from "@/lib/types";

const isLevel = (v: unknown): v is ClassLevel => typeof v === "string" && v in CLASS_LEVELS;
const isType = (v: unknown): v is OpportunityType =>
  typeof v === "string" && (OPPORTUNITY_TYPES as readonly string[]).includes(v);

// POST { phone: "+15551234567", levels: ["freshman"], types: [] }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    phone?: unknown;
    levels?: unknown;
    types?: unknown;
  } | null;

  const phone = typeof body?.phone === "string" ? body.phone : "";
  const levels = Array.isArray(body?.levels) ? body.levels.filter(isLevel) : [];
  const types = Array.isArray(body?.types) ? body.types.filter(isType) : [];

  if (!/^\+1\d{10}$/.test(phone)) {
    return Response.json({ ok: false, error: "Enter a 10-digit US phone number." }, { status: 400 });
  }
  if (levels.length === 0) {
    return Response.json({ ok: false, error: "Pick freshman or sophomore." }, { status: 400 });
  }

  const sub = await upsertSubscriber({ phone, levels, types });
  const message = welcomeText(sub);
  try {
    const { dryRun } = await sendSms(phone, message, { essential: false });
    return Response.json({ ok: true, dryRun, messages: [message] });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
