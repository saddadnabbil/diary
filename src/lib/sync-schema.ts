import { z } from "zod";
import { MOODS } from "./types";

/** Bodies are rich-text JSON, which is much more verbose than the visible text. */
export const MAX_BODY_CHARS = 200_000;
export const MAX_CHANGES_PER_REQUEST = 50;
export const MAX_PULL = 200;
export const MAX_ENTRIES_PER_USER = 20_000;

/** An entry as it travels between device and server. */
export const WireEntry = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  title: z.string().max(200),
  body: z.string().max(MAX_BODY_CHARS),
  mood: z.enum(MOODS).nullable(),
  promptUsed: z.string().max(300).nullable(),
  createdAt: z.number().int().min(0).max(8.64e15),
  updatedAt: z.number().int().min(0).max(8.64e15),
  deletedAt: z.number().int().min(0).max(8.64e15).nullable(),
});
export type WireEntry = z.infer<typeof WireEntry>;

export const SyncRequest = z.object({
  /** Last server_seq the client has seen. */
  since: z.number().int().min(0),
  changes: z.array(WireEntry).max(MAX_CHANGES_PER_REQUEST),
  limit: z.number().int().min(1).max(MAX_PULL).default(MAX_PULL),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export interface SyncResponse {
  changes: (WireEntry & { seq: number })[];
  cursor: number;
  hasMore: boolean;
}
