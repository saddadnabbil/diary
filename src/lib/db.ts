import Dexie, { type EntityTable } from "dexie";
import { BUILTIN_PROVIDER, DEFAULT_PROVIDER_ID } from "./providers";
import { MAX_BODY_CHARS } from "./sync-schema";
import type { AppSettings, Entry, LlmProvider, StoredImage } from "./types";

class DiaryDB extends Dexie {
  entries!: EntityTable<Entry, "id">;
  providers!: EntityTable<LlmProvider, "id">;
  settings!: EntityTable<AppSettings, "id">;
  images!: EntityTable<StoredImage, "id">;

  constructor() {
    super("diary");
    this.version(1).stores({
      entries: "id, createdAt, updatedAt, deletedAt",
      providers: "id",
      settings: "id",
    });
    // v2: sync support. Existing entries are marked dirty so they upload when cloud sync is on.
    this.version(2)
      .stores({ entries: "id, createdAt, updatedAt, deletedAt, dirty" })
      .upgrade((tx) =>
        tx
          .table("entries")
          .toCollection()
          .modify((e) => {
            e.dirty = 1;
          }),
      );
    // v3: images pasted or uploaded into entries (kept on this device).
    this.version(3).stores({ images: "id, createdAt" });
    // v4: track which images are uploaded to the cloud.
    this.version(4)
      .stores({ images: "id, createdAt, uploaded" })
      .upgrade((tx) =>
        tx
          .table("images")
          .toCollection()
          .modify((i) => {
            i.uploaded = 0;
          }),
      );
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: "me",
  onboarded: false,
  storageMode: "cloud",
  email: null,
  defaultProviderId: DEFAULT_PROVIDER_ID,
  personalize: false,
  ownerId: null,
  aiEnabled: false,
  displayName: null,
  syncCursor: 0,
  lastSyncedAt: null,
};

export const db = new DiaryDB();

/* The sync engine subscribes here, which keeps db.ts free of an import cycle. */
const listeners = new Set<() => void>();
export const onLocalChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const notifyLocalChange = () => listeners.forEach((fn) => fn());

/** Idempotent first-run seed. Safe to call on every app start. */
export async function ensureSeed(): Promise<void> {
  await db.transaction("rw", db.settings, db.providers, async () => {
    const existing = await db.settings.get("me");
    // Fill in fields added by newer versions without touching what the user already chose.
    if (!existing) await db.settings.add(DEFAULT_SETTINGS);
    else await db.settings.update("me", { ...DEFAULT_SETTINGS, ...existing });
    if (!(await db.providers.get(DEFAULT_PROVIDER_ID))) await db.providers.add(BUILTIN_PROVIDER);
  });
}

export async function updateSettings(patch: Partial<Omit<AppSettings, "id">>): Promise<void> {
  await db.settings.update("me", patch);
}

/**
 * Remove everything personal from this device: entries, API keys and account info.
 * Used on sign-out (cloud mode), account switch and account deletion.
 */
export async function wipeLocal(): Promise<void> {
  await db.transaction("rw", db.entries, db.providers, db.settings, db.images, async () => {
    await db.entries.clear();
    await db.images.clear();
    await db.providers.clear();
    await db.settings.clear();
    await db.providers.add(BUILTIN_PROVIDER);
    await db.settings.add(DEFAULT_SETTINGS);
  });
}

/** Turn cloud sync on: every local entry is queued for upload and the server is pulled from the start. */
export async function enableCloudSync(): Promise<void> {
  await db.transaction("rw", db.entries, db.settings, db.images, async () => {
    await db.entries.toCollection().modify({ dirty: 1 });
    await db.images.toCollection().modify({ uploaded: 0 });
    await db.settings.update("me", { storageMode: "cloud", syncCursor: 0 });
  });
  notifyLocalChange();
}

/* ---------- images ---------- */

/** Keep a new image on this device and queue it for upload. */
export async function addImage(blob: Blob): Promise<string> {
  const id = newId();
  await db.images.add({ id, blob, type: blob.type, createdAt: Date.now(), uploaded: 0 });
  notifyLocalChange();
  return id;
}

/* ---------- entries ---------- */

export function newId(): string {
  return crypto.randomUUID();
}

export async function createEntry(init: Partial<Entry> = {}): Promise<Entry> {
  const now = Date.now();
  const entry: Entry = {
    id: newId(),
    title: "",
    body: "",
    kind: "entry",
    mediaId: null,
    mood: null,
    promptUsed: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
    ...init,
  };
  await db.entries.add(entry);
  notifyLocalChange();
  return entry;
}

export async function saveEntry(id: string, patch: Partial<Pick<Entry, "title" | "body" | "mood" | "promptUsed" | "createdAt" | "mediaId">>): Promise<void> {
  await db.entries.update(id, { ...patch, updatedAt: Date.now(), dirty: 1 });
  notifyLocalChange();
}

export async function deleteEntry(id: string): Promise<void> {
  const now = Date.now();
  await db.entries.update(id, { title: "", body: "", mood: null, promptUsed: null, deletedAt: now, updatedAt: now, dirty: 1 });
  notifyLocalChange();
}

export const isLive = (e: Entry) => e.deletedAt === null;

/* ---------- import / export ---------- */

export async function exportEntries(): Promise<string> {
  const entries = (await db.entries.toArray()).filter(isLive).map(({ dirty: _dirty, ...rest }) => {
    void _dirty;
    return rest;
  });
  return JSON.stringify({ app: "diary", version: 1, exportedAt: Date.now(), entries }, null, 2);
}

export async function importEntries(json: string): Promise<number> {
  const data = JSON.parse(json) as { app?: string; entries?: Partial<Entry>[] };
  if (data.app !== "diary" || !Array.isArray(data.entries)) throw new Error("Not a Diary export file.");
  const moods = new Set(["Calm", "Happy", "Tired", "Anxious", "Grateful"]);
  const normalised: Entry[] = [];
  for (const e of data.entries) {
    if (typeof e.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(e.id)) continue;
    if (typeof e.body !== "string" || typeof e.createdAt !== "number" || !Number.isFinite(e.createdAt)) continue;
    normalised.push({
      id: e.id,
      title: typeof e.title === "string" ? e.title.slice(0, 200) : "",
      body: e.body.slice(0, MAX_BODY_CHARS),
      mood: e.mood && moods.has(e.mood) ? e.mood : null,
      promptUsed: typeof e.promptUsed === "string" ? e.promptUsed.slice(0, 300) : null,
      createdAt: Math.trunc(e.createdAt),
      updatedAt: typeof e.updatedAt === "number" && Number.isFinite(e.updatedAt) ? Math.trunc(e.updatedAt) : Math.trunc(e.createdAt),
      kind: e.kind === "story" ? "story" : "entry",
      mediaId: typeof e.mediaId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(e.mediaId) ? e.mediaId : null,
      deletedAt: null,
      dirty: 1,
    });
  }
  await db.entries.bulkPut(normalised);
  notifyLocalChange();
  return normalised.length;
}
