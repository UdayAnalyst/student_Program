import { advise } from "@/lib/assistant";

// POST { query: "I'm a freshman into AI..." } → matched programs with summaries.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (query.length < 3) {
    return Response.json({ ok: false, error: "Tell us a bit about what you're looking for." }, { status: 400 });
  }
  if (query.length > 600) {
    return Response.json({ ok: false, error: "That's a lot! Try a shorter description (under 600 characters)." }, { status: 400 });
  }

  const result = await advise(query);
  return Response.json({ ok: true, ...result });
}
