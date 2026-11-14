"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, isLive } from "@/lib/db";
import { moodOptions } from "@/lib/moods";
import type { Entry } from "@/lib/types";

/** All non-deleted entries, newest first. `undefined` while loading. */
export function useEntries(): Entry[] | undefined {
  return useLiveQuery(async () => (await db.entries.orderBy("createdAt").reverse().toArray()).filter(isLive), []);
}

/**
 * One entry. `undefined` while loading, `null` when missing or deleted.
 */
export function useEntry(id: string): Entry | null | undefined {
  return useLiveQuery(async () => {
    const e = await db.entries.get(id);
    return e && isLive(e) ? e : null;
  }, [id]);
}

/** Friendly first name from an email address, e.g. "nadia.putri@x.com" -> "Nadia". */
export function displayName(email: string | null | undefined): string | null {
  const first = email?.split("@")[0]?.split(/[._\-+0-9]/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Every mood a person can pick: the presets plus the ones they added, most used first. */
export function useMoodOptions(extra: readonly string[] = []): string[] {
  const entries = useEntries();
  return moodOptions((entries ?? []).map((e) => e.mood), extra);
}
