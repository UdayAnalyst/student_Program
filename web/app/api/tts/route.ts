// POST { text } → spoken audio (MP3) from ElevenLabs, for the voice assistant.
// Needs ELEVENLABS_API_KEY; ELEVENLABS_VOICE_ID and ELEVENLABS_MODEL_ID are optional.
// Without a key it answers 501 and the browser falls back to its built-in voice.
// The key stays on the server; the browser only ever gets audio.
// Default: Bella (hpp4J3VqNfWAUOO0d1Us) — free built-in voice used for Launchpad read-overs.
// Do not use ElevenLabs' docs example voice (George / JBFqnCBsd6RMkjVDRZzb) here.
const DEFAULT_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us"; // Bella
const DEFAULT_MODEL_ID = "eleven_flash_v2_5"; // their lowest-latency model
const MAX_CHARS = 1000; // answers are a few sentences; this also caps credit use per request

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return Response.json({ ok: false, error: "ElevenLabs isn't configured." }, { status: 501 });

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_CHARS) {
    return Response.json({ ok: false, error: `Text must be 1-${MAX_CHARS} characters.` }, { status: 400 });
  }

  const tts = (voiceId: string) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  let res = await tts(voiceId);
  // Free plans can't use Voice Library voices via the API (402). Fall back to Bella
  // (the Launchpad default) so the assistant still speaks with the intended voice.
  if (res.status === 402 && voiceId !== DEFAULT_VOICE_ID) {
    console.warn(`[tts] voice ${voiceId} needs a paid ElevenLabs plan; using Bella (${DEFAULT_VOICE_ID}) instead`);
    res = await tts(DEFAULT_VOICE_ID);
  }

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error(`[tts] ElevenLabs error ${res.status}: ${detail.slice(0, 200)}`);
    return Response.json({ ok: false, error: `ElevenLabs error ${res.status}` }, { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
