import { MAX_ENTRIES_PER_USER, type SyncResponse, type WireEntry } from "../sync-schema";
import type { Db } from "./db";

/** Allow modest clock skew; anything further in the future is clamped so it cannot win last-write-wins forever. */
const MAX_SKEW_MS = 5 * 60_000;

export class QuotaError extends Error {}

interface Row {
  id: string;
  title: string;
  body: string;
  mood: WireEntry["mood"];
  prompt_used: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
  server_seq: number;
}

/**
 * Upsert changes for one user with last-write-wins on `updated_at`.
 * A change older than (or equal to) what the server holds is ignored.
 * Deleted entries keep a tombstone but lose their content.
 */
export async function applyChanges(db: Db, userId: string, changes: WireEntry[], nowMs: number = Date.now()): Promise<void> {
  if (changes.length === 0) return;

  const countRow = await db.prepare("SELECT COUNT(*) AS n FROM entries WHERE user_id = ?1").bind(userId).first<{ n: number }>();
  // Hard cap per account; a request can overshoot by at most MAX_CHANGES_PER_REQUEST rows.
  if ((countRow?.n ?? 0) >= MAX_ENTRIES_PER_USER) throw new QuotaError("Entry limit reached.");

  const ceiling = nowMs + MAX_SKEW_MS;
  const upsert = `
    INSERT INTO entries (user_id, id, title, body, mood, prompt_used, created_at, updated_at, deleted_at, server_seq)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
      (SELECT COALESCE(MAX(server_seq), 0) + 1 FROM entries WHERE user_id = ?1))
    ON CONFLICT(user_id, id) DO UPDATE SET
      title = excluded.title,
      body = excluded.body,
      mood = excluded.mood,
      prompt_used = excluded.prompt_used,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      server_seq = excluded.server_seq
    WHERE excluded.updated_at > entries.updated_at`;

  const statements = changes.map((c) => {
    const deleted = c.deletedAt !== null;
    return db
      .prepare(upsert)
      .bind(
        userId,
        c.id,
        deleted ? "" : c.title,
        deleted ? "" : c.body,
        deleted ? null : c.mood,
        deleted ? null : c.promptUsed,
        Math.min(c.createdAt, ceiling),
        Math.min(c.updatedAt, ceiling),
        c.deletedAt === null ? null : Math.min(c.deletedAt, ceiling),
      );
  });
  await db.batch(statements);
}

/** Everything that changed after `since`, oldest first. */
export async function pullChanges(db: Db, userId: string, since: number, limit: number): Promise<SyncResponse> {
  const { results } = await db
    .prepare(
      `SELECT id, title, body, mood, prompt_used, created_at, updated_at, deleted_at, server_seq
       FROM entries WHERE user_id = ?1 AND server_seq > ?2 ORDER BY server_seq ASC LIMIT ?3`,
    )
    .bind(userId, since, limit + 1)
    .all<Row>();

  const hasMore = results.length > limit;
  const page = hasMore ? results.slice(0, limit) : results;
  return {
    changes: page.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      mood: r.mood,
      promptUsed: r.prompt_used,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      seq: r.server_seq,
    })),
    cursor: page.length ? page[page.length - 1].server_seq : since,
    hasMore,
  };
}

/** Permanently remove a user and everything they own. */
export async function deleteAccountData(db: Db, userId: string, email: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM entries WHERE user_id = ?1").bind(userId),
    db.prepare('DELETE FROM "session" WHERE "userId" = ?1').bind(userId),
    db.prepare('DELETE FROM "account" WHERE "userId" = ?1').bind(userId),
    db.prepare('DELETE FROM "verification" WHERE "identifier" = ?1').bind(email.toLowerCase()),
    // Per-user counters (see guard.ts buckets). Exact keys, no LIKE wildcards.
    db
      .prepare("DELETE FROM rate_limit_hits WHERE key IN (?1, ?2, ?3, ?4)")
      .bind(`sync:${userId}`, `suggest:${userId}`, `provider-test:${userId}`, `account-delete:${userId}`),
    db.prepare('DELETE FROM "user" WHERE "id" = ?1').bind(userId),
  ]);
}
