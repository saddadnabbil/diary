"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
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

/** Whether the user turned AI on in Settings. False until the settings row has been read. */
function useAiEnabled(): boolean {
  return useLiveQuery(async () => (await db.settings.get("me"))?.aiEnabled === true, [], false);
}

async function loadAi(mood: Mood | null, count: number, seen: string[]): Promise<Result> {
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
 * Prompts for the editor and the dashboard.
 *
 * Built-in prompts (the default) are picked synchronously: no database read, no network and no
 * loading state, so the dashboard shows a prompt on the first paint. Only when AI is turned on does
 * it ask the model, and it falls back to the built-in list if the model is unavailable.
 */
export function useSuggestions(mood: Mood | null, count = 3) {
  const aiEnabled = useAiEnabled();
  const [nonce, setNonce] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  const key = `${mood ?? ""}:${count}:${nonce}`;

  // Built-in list: recomputed only when mood, count or a shuffle (nonce) changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nonce is the shuffle trigger
  const builtin = useMemo(() => pickPrompts({ mood, count, exclude: seen }), [mood, count, seen, nonce]);

  const [aiResult, setAiResult] = useState<(Result & { key: string }) | null>(null);
  const aiSeen = useRef<string[]>([]);

  useEffect(() => {
    if (!aiEnabled) return;
    let cancelled = false;
    void loadAi(mood, count, aiSeen.current).then((r) => {
      if (cancelled) return;
      aiSeen.current = [...aiSeen.current, ...r.suggestions.map((s) => s.text)].slice(-30);
      setAiResult({ ...r, key });
    });
    return () => {
      cancelled = true;
    };
  }, [key, mood, count, aiEnabled]);

  const refresh = () => {
    setSeen((prev) => [...prev, ...builtin.map((s) => s.text)].slice(-30));
    setNonce((n) => n + 1);
  };

  if (!aiEnabled) {
    return { suggestions: builtin, source: "fallback" as SuggestionSource, notice: null, loading: false, refresh };
  }
  return {
    suggestions: aiResult?.key === key ? aiResult.suggestions : (aiResult?.suggestions ?? []),
    source: aiResult?.source ?? null,
    notice: aiResult?.key === key ? aiResult.notice : null,
    /** True until the response for the current mood/shuffle has arrived. */
    loading: aiResult?.key !== key,
    refresh,
  };
}
