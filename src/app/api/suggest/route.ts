import { generateText, Output } from "ai";
import { z } from "zod";
import { describeModelError, ProviderInput, resolveModel } from "@/lib/server/model";
import { guard } from "@/lib/server/guard";
import { apiError, json, readJson } from "@/lib/server/http";
import { MOODS } from "@/lib/types";

export const maxDuration = 30;

const Body = z.object({
  mood: z.enum(MOODS).nullable(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]),
  /** Titles of recent entries, only sent when the user opted in. Themes only, never bodies. */
  recentTitles: z.array(z.string().max(80)).max(3).default([]),
  /** Omit to use the built-in default model. */
  provider: ProviderInput.optional(),
});

const Result = z.object({
  suggestions: z
    .array(z.object({ category: z.string().max(24), text: z.string().max(160) }))
    .min(1)
    .max(5),
});

const SYSTEM = [
  "You write journaling prompts that feel like a thoughtful friend asking a question: warm, specific and easy to answer in a few sentences.",
  "Rules: each prompt is one open question or gentle invitation of at most 18 words, in plain everyday English, addressed to the reader as \"you\". Avoid clichés, jargon and yes/no questions. Prefer concrete moments (today, this week) over abstract ideas.",
  "Use a different category for each prompt, chosen from: Gratitude, Reflection, Memory, Goals, Calm, Joy, Creativity, Rest, Connection.",
  "Never give advice, diagnoses or instructions. Never mention that you are an AI.",
  'Respond with JSON only, shaped like {"suggestions":[{"category":"Gratitude","text":"..."}]}, containing exactly 3 prompts.',
].join(" ");

export async function POST(req: Request) {
  const g = await guard(req, { bucket: "suggest", limit: 30, windowSec: 60 });
  if (g instanceof Response) return g;

  const body = await readJson(req, 16 * 1024);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.value);
  if (!parsed.success) return apiError(400, "bad_request", "Invalid request.");
  const { mood, timeOfDay, recentTitles, provider } = parsed.data;

  const lines = [`Time of day: ${timeOfDay}.`, `Mood: ${mood ?? "not given"}.`];
  if (recentTitles.length) lines.push(`Recent entry titles (use only for loose themes): ${recentTitles.join("; ")}.`);

  try {
    const { output } = await generateText({
      model: resolveModel(g.env, provider),
      system: SYSTEM,
      prompt: lines.join("\n"),
      output: Output.object({ schema: Result }),
      temperature: 0.9,
      maxOutputTokens: 400,
      abortSignal: AbortSignal.timeout(15_000),
    });
    return json({ suggestions: output.suggestions.slice(0, 3), source: "ai" });
  } catch (e) {
    const { code, message } = describeModelError(e);
    return apiError(code === "no_default_key" || code === "bad_url" ? 422 : 502, code, message);
  }
}
