"use client";

import { useSyncExternalStore } from "react";
import { db, onLocalChange } from "./db";
import { mergeRemote, toWire } from "./sync-merge";
import { MAX_CHANGES_PER_REQUEST, MAX_PULL, type SyncResponse } from "./sync-schema";

export type SyncStatus = "idle" | "syncing" | "error" | "offline" | "signed-out";

export interface SyncState {
  status: SyncStatus;
  message: string | null;
}

let state: SyncState = { status: "idle", message: null };
const subscribers = new Set<() => void>();
const setState = (next: SyncState) => {
  state = next;
  subscribers.forEach((fn) => fn());
};

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => state,
    () => state,
  );
}

class SyncError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "rate" | "server" | "network",
    public retryAfterSec?: number,
  ) {
    super(message);
  }
}

async function exchange(body: { since: number; changes: ReturnType<typeof toWire>[]; limit: number }): Promise<SyncResponse> {
  let res: Response;
  try {
    res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SyncError("Offline", "network");
  }
  if (res.status === 401) throw new SyncError("Signed out", "auth");
  if (res.status === 429) throw new SyncError("Slow down", "rate", Number(res.headers.get("retry-after")) || 60);
  if (!res.ok) throw new SyncError("Server error", "server");
  return (await res.json()) as SyncResponse;
}

/** Upload images that exist only on this device. They go up before the entries that reference them. */
async function pushImages(): Promise<void> {
  const pending = await db.images.where("uploaded").equals(0).limit(20).toArray();
  for (const img of pending) {
    let res: Response;
    try {
      res = await fetch(`/api/images/${encodeURIComponent(img.id)}`, { method: "PUT", headers: { "content-type": img.type }, body: img.blob });
    } catch {
      throw new SyncError("Offline", "network");
    }
    if (res.status === 401) throw new SyncError("Signed out", "auth");
    if (res.status === 429) throw new SyncError("Slow down", "rate", Number(res.headers.get("retry-after")) || 60);
    if (res.status >= 500) throw new SyncError("Server error", "server");
    // 2xx: stored. Other 4xx: the server will never accept it, so stop retrying.
    await db.images.update(img.id, { uploaded: res.ok ? 1 : 2 });
  }
}

const imageAttempts = new Map<string, number>();

/** Download an image that an entry references but this device does not have yet. */
export async function fetchRemoteImage(id: string): Promise<void> {
  const settings = await db.settings.get("me");
  if (settings?.storageMode !== "cloud") return;
  const last = imageAttempts.get(id) ?? 0;
  if (Date.now() - last < 60_000) return; // do not hammer on failures or while one is in flight
  imageAttempts.set(id, Date.now());
  try {
    const res = await fetch(`/api/images/${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const blob = await res.blob();
    if (!(await db.images.get(id))) await db.images.add({ id, blob, type: blob.type, createdAt: Date.now(), uploaded: 1 });
  } catch {
    /* offline: it will be retried the next time the entry is shown */
  }
}

/** One full sync: push everything dirty, pull everything new, until both sides are caught up. */
async function runOnce(): Promise<void> {
  const settings = await db.settings.get("me");
  if (!settings || settings.storageMode !== "cloud") return;

  await pushImages();
  let cursor = settings.syncCursor ?? 0;
  for (let round = 0; round < 100; round++) {
    const dirty = await db.entries.where("dirty").equals(1).limit(MAX_CHANGES_PER_REQUEST).toArray();
    const res = await exchange({ since: cursor, changes: dirty.map(toWire), limit: MAX_PULL });

    await db.transaction("rw", db.entries, db.settings, async () => {
      // Acknowledged, unless the user edited again while the request was in flight.
      for (const sent of dirty) {
        const cur = await db.entries.get(sent.id);
        if (cur && cur.updatedAt === sent.updatedAt) await db.entries.update(sent.id, { dirty: 0 });
      }
      for (const remote of res.changes) {
        const next = mergeRemote(await db.entries.get(remote.id), remote);
        if (next) await db.entries.put(next);
      }
      await db.settings.update("me", { syncCursor: res.cursor, lastSyncedAt: Date.now() });
    });
    cursor = res.cursor;

    if (!res.hasMore && dirty.length < MAX_CHANGES_PER_REQUEST) return;
  }
}

let running: Promise<void> | null = null;
let queued = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;

/** Run a sync now. Calls made while one is running are coalesced into a single follow-up run. */
export function syncNow(): Promise<void> {
  if (running) {
    queued = true;
    return running;
  }
  setState({ status: "syncing", message: null });
  running = runOnce()
    .then(() => {
      failures = 0;
      setState({ status: "idle", message: null });
    })
    .catch((e: unknown) => {
      const err = e instanceof SyncError ? e : new SyncError("Sync failed", "server");
      failures++;
      if (err.kind === "auth") return setState({ status: "signed-out", message: "Your session ended. Sign in again to keep syncing." });
      setState({
        status: err.kind === "network" ? "offline" : "error",
        message: err.kind === "network" ? "Offline. Changes are saved on this device and will sync later." : err.kind === "rate" ? "Syncing too fast. Pausing briefly." : "Could not sync. Will retry.",
      });
      clearTimeout(retryTimer);
      const delay = err.retryAfterSec ? err.retryAfterSec * 1000 : Math.min(30_000 * 2 ** (failures - 1), 5 * 60_000);
      retryTimer = setTimeout(() => void syncNow(), delay);
    })
    .finally(() => {
      running = null;
      if (queued) {
        queued = false;
        void syncNow();
      }
    });
  return running;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
export function requestSync(delayMs = 1500): void {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), delayMs);
}

/** Wire up automatic syncing. Returns a cleanup function. Call once the user is signed in. */
export function startSyncRunner(): () => void {
  const onVisible = () => document.visibilityState === "visible" && requestSync(0);
  const onOnline = () => requestSync(0);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = setInterval(() => requestSync(0), 60_000);
  const offLocal = onLocalChange(() => requestSync());
  requestSync(0);
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(interval);
    clearTimeout(debounce);
    clearTimeout(retryTimer);
    offLocal();
  };
}
