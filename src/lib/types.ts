export const MOODS = ["Calm", "Happy", "Tired", "Anxious", "Grateful"] as const;
export type Mood = (typeof MOODS)[number];

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export interface Entry {
  id: string;
  title: string;
  body: string;
  mood: Mood | null;
  promptUsed: string | null;
  createdAt: number;
  updatedAt: number;
  /** Soft delete so removals propagate to other devices. */
  deletedAt: number | null;
  /** 1 while this device has changes the server has not acknowledged. Never leaves the device. */
  dirty: 0 | 1;
}

export type StorageMode = "cloud" | "local";

export interface AppSettings {
  id: "me";
  onboarded: boolean;
  storageMode: StorageMode;
  email: string | null;
  /** id of the LlmProvider that writes suggestions */
  defaultProviderId: string;
  /** Send the titles of the 3 most recent entries to the model for better prompts. */
  personalize: boolean;
  /** Account that owns the data on this device. A different account signing in wipes it. */
  ownerId: string | null;
  /** Highest server change number already applied locally. */
  syncCursor: number;
  lastSyncedAt: number | null;
}

export type PresetId =
  | "deepseek"
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter"
  | "custom";

export interface LlmProvider {
  id: string;
  preset: PresetId;
  label: string;
  baseURL: string;
  model: string;
  /** Stored on this device only. Empty for the built-in default (server key). */
  apiKey: string;
  builtin: boolean;
}

export interface Suggestion {
  category: string;
  text: string;
}

export interface StoredImage {
  id: string;
  blob: Blob;
  type: string;
  createdAt: number;
  /** 0 = waiting to upload, 1 = in the cloud (or downloaded from it), 2 = the server refused it. */
  uploaded: 0 | 1 | 2;
}
