"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { db, ensureSeed } from "@/lib/db";
import { DEFAULT_PROVIDER_ID } from "@/lib/providers";
import type { AppSettings, LlmProvider } from "@/lib/types";

/** Settings from IndexedDB. `undefined` while loading. Seeds defaults on first run. */
export function useSettings(): AppSettings | undefined {
  useEffect(() => {
    void ensureSeed();
  }, []);
  return useLiveQuery(() => db.settings.get("me"), []);
}

export function useProviders(): LlmProvider[] | undefined {
  return useLiveQuery(() => db.providers.toArray(), []);
}

export function useDefaultProvider(): LlmProvider | undefined {
  return useLiveQuery(async () => {
    const s = await db.settings.get("me");
    return (await db.providers.get(s?.defaultProviderId ?? DEFAULT_PROVIDER_ID)) ?? (await db.providers.get(DEFAULT_PROVIDER_ID));
  }, []);
}
