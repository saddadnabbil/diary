import { generateText } from "ai";
import { z } from "zod";
import { describeModelError, ProviderInput, resolveModel } from "@/lib/server/model";
import { guard } from "@/lib/server/guard";
import { apiError, json, readJson } from "@/lib/server/http";

export const maxDuration = 20;

const Body = z.object({ provider: ProviderInput.optional() });

/** "Test connection": one tiny completion, reports ok/latency, never echoes the key. */
export async function POST(req: Request) {
  const g = await guard(req, { bucket: "provider-test", limit: 10, windowSec: 60 });
  if (g instanceof Response) return g;

  const body = await readJson(req, 4096);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.value);
  if (!parsed.success) return apiError(400, "bad_request", "Invalid request.");

  const started = Date.now();
  try {
    await generateText({
      model: resolveModel(g.env, parsed.data.provider),
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 8,
      abortSignal: AbortSignal.timeout(10_000),
    });
    return json({ ok: true, latencyMs: Date.now() - started });
  } catch (e) {
    const { code, message } = describeModelError(e);
    return json({ ok: false, error: code, message });
  }
}
