import type { Entry } from "./types";
import type { WireEntry } from "./sync-schema";

export function toWire(e: Entry): WireEntry {
  return {
    id: e.id,
    title: e.title,
    body: e.body,
    mood: e.mood,
    promptUsed: e.promptUsed,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  };
}

/**
 * Decide what to store when the server sends us `remote` and we may already have `local`.
 * Returns the entry to write, or null to leave the local copy alone.
 * Last-write-wins on `updatedAt`; unsynced local edits that are newer are never overwritten.
 */
export function mergeRemote(local: Entry | undefined, remote: WireEntry): Entry | null {
  if (local) {
    if (local.dirty === 1 && local.updatedAt >= remote.updatedAt) return null;
    if (local.dirty === 0 && local.updatedAt >= remote.updatedAt) return null;
  }
  return { ...remote, dirty: 0 };
}
