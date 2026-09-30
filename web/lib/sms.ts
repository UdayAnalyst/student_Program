export type SendResult = { dryRun: boolean; id?: string };

// Picks a provider from env (.env.local):
//   SMS_PROVIDER=demo      → dry-run, even if provider keys are set (for presentations).
//   SMS_PROVIDER=whatsapp  → Twilio WhatsApp Sandbox (free on trial; the recipient must first send
//                            "join <code>" to the sandbox number). Uses TWILIO_ACCOUNT_SID/AUTH_TOKEN;
//                            TWILIO_WHATSAPP_FROM defaults to Twilio's shared sandbox number.
//   SMS_PROVIDER=textbelt  → Textbelt. TEXTBELT_KEY defaults to the free "textbelt" key (1 text/day, US only).
//   TWILIO_* all set       → Twilio.
//   otherwise              → dry-run: logs the message instead of texting it.
// `essential: false` marks nice-to-have texts (e.g. the welcome) that skip the free
// Textbelt quota so the one free daily text goes to the actual opportunities alert.
// Server-only: imported by app/api/* routes.
export async function sendSms(
  to: string,
  body: string,
  { essential = true }: { essential?: boolean } = {},
): Promise<SendResult> {
  if (process.env.SMS_PROVIDER === "demo") return dryRun(to, body);
  if (process.env.SMS_PROVIDER === "whatsapp") {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token } = process.env;
    if (!sid || !token) throw new Error("Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.local");
    const from = process.env.TWILIO_WHATSAPP_FROM || "+14155238886";
    return sendTwilio(`whatsapp:${to}`, body, sid, token, `whatsapp:${from}`);
  }
  if (process.env.SMS_PROVIDER === "textbelt") {
    const key = process.env.TEXTBELT_KEY || "textbelt";
    if (key === "textbelt" && !essential) return dryRun(to, body);
    return sendTextbelt(to, body, key);
  }

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } = process.env;
  if (sid && token && from) return sendTwilio(to, body, sid, token, from);

  return dryRun(to, body);
}

function dryRun(to: string, body: string): SendResult {
  console.log(`\n[sms dry-run] → ${to}\n${body}\n`);
  return { dryRun: true };
}

async function sendTextbelt(to: string, body: string, key: string): Promise<SendResult> {
  const res = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ phone: to, message: body, key }),
  });
  const data = (await res.json().catch(() => null)) as
    | { success: boolean; textId?: string; quotaRemaining?: number; error?: string }
    | null;
  if (!data?.success) {
    const reason = `Textbelt: ${data?.error ?? `request failed (${res.status})`}`;
    console.error(`[sms] ${reason}`);
    throw new Error(reason);
  }
  console.log(`[sms] sent via Textbelt (quota remaining: ${data.quotaRemaining ?? "?"})`);
  return { dryRun: false, id: data.textId };
}

// Twilio's WhatsApp "Tryout" sender rejects plain Body text (error 21654), so when
// TWILIO_WHATSAPP_CONTENT_SID is set, WhatsApp messages go through a Content Template
// whose body is just "{{1}}", with our text as the variable.
function twilioContent(to: string, from: string, body: string): Record<string, string> {
  const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
  if (to.startsWith("whatsapp:") && contentSid) {
    return { To: to, From: from, ContentSid: contentSid, ContentVariables: JSON.stringify({ 1: body }) };
  }
  return { To: to, From: from, Body: body };
}

async function sendTwilio(to: string, body: string, sid: string, token: string, from: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(twilioContent(to, from, body)),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    let reason = `Twilio error ${detail?.code ?? res.status}: ${detail?.message ?? "request failed"}`;
    // WhatsApp only allows free-form text within 24h of the user's last message to the sandbox.
    if (to.startsWith("whatsapp:") && (detail?.code === 21654 || detail?.code === 63016)) {
      reason = `This number has no open WhatsApp session. From WhatsApp on ${to.slice(9)}, send your "join <code>" message to ${from.slice(9)}, wait for Twilio's reply, then try again. (Twilio ${detail.code})`;
    }
    console.error(`[sms] ${reason}`);
    throw new Error(reason);
  }
  const data = (await res.json()) as { sid: string; status?: string };
  console.log(`[sms] sent via Twilio to ${to} (sid ${data.sid}, status ${data.status ?? "?"})`);
  return { dryRun: false, id: data.sid };
}
