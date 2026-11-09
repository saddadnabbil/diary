"use client";

import { useEffect, useRef, useState } from "react";
import { db, isLive } from "@/lib/db";
import { timeOfDay } from "@/lib/dates";
import { pickPrompts } from "@/lib/prompts";
import { DEFAULT_PROVIDER_ID } from "@/lib/providers";
import type { Mood, Suggestion } from "@/lib/types";

export type SuggestionSource = "ai" | "fallback";

interface Result {
  suggestions: Suggestion[];
  source: SuggestionSource;
  /** Why the model was not used, when source is "fallback". */
  notice: string | null;
}

async function load(mood: Mood | null, count: number, seen: string[]): Promise<Result> {
  const fallback = (notice: string | null): Result => ({
    suggestions: pickPrompts({ mood, count, exclude: seen }),
    source: "fallback",
    notice,
  });

  const settings = await db.settings.get("me");
  const provider = await db.providers.get(settings?.defaultProviderId ?? DEFAULT_PROVIDER_ID);
  const recentTitles = settings?.personalize
    ? (await db.entries.orderBy("createdAt").reverse().filter(isLive).limit(3).toArray()).map((e) => e.title.trim()).filter(Boolean)
    : [];

  try {
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mood,
        timeOfDay: timeOfDay(new Date().getHours()),
        recentTitles,
        provider: provider && !provider.builtin ? { baseURL: provider.baseURL, model: provider.model, apiKey: provider.apiKey } : undefined,
      }),
    });
    const data = (await res.json()) as { suggestions?: Suggestion[]; message?: unknown };
    if (!res.ok || !Array.isArray(data.suggestions)) {
      return fallback(typeof data.message === "string" ? data.message : "The model is unavailable.");
    }
    return { suggestions: data.suggestions.slice(0, count), source: "ai", notice: null };
  } catch {
    return fallback("Offline.");
  }
}

/**
 * Asks the configured model for prompts and falls back to the built-in list
 * when the model is unreachable or not configured, so the editor never breaks.
 * Re-fetches when the mood changes or `refresh()` is called.
 */
export function useSuggestions(mood: Mood | null, count = 3) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<(Result & { key: string }) | null>(null);
  const seen = useRef<string[]>([]);
  const key = `${mood ?? ""}:${count}:${nonce}`;

  useEffect(() => {
    let cancelled = false;
    void load(mood, count, seen.current).then((r) => {
      if (cancelled) return;
      seen.current = [...seen.current, ...r.suggestions.map((s) => s.text)].slice(-30);
      setResult({ ...r, key });
    });
    return () => {
      cancelled = true;
    };
  }, [key, mood, count]);

  return {
    suggestions: result?.suggestions ?? [],
    source: result?.source ?? null,
    notice: result?.notice ?? null,
    /** True until the response for the current mood/shuffle has arrived. */
    loading: result?.key !== key,
    refresh: () => setNonce((n) => n + 1),
  };
}
