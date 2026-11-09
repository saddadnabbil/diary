import type { Db } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends. */
  retryAfter: number;
}

/**
 * Fixed-window counter in D1. D1 has a single writer, so the upsert is atomic and
 * the count is exact across every Worker instance (unlike in-memory counters).
 */
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSec: number,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const nowSec = Math.floor(nowMs / 1000);
  const windowStart = nowSec - (nowSec % windowSec);
  const row = await db
    .prepare(
      `INSERT INTO rate_limit_hits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();

  // Housekeeping: occasionally drop counters from windows that ended over a day ago.
  if (Math.random() < 0.01) {
    await db.prepare("DELETE FROM rate_limit_hits WHERE window_start < ?1").bind(nowSec - 86_400).run();
  }

  const count = row?.count ?? 1;
  return { allowed: count <= limit, retryAfter: Math.max(1, windowStart + windowSec - nowSec) };
}

/** SHA-256 hex, so identifiers like emails are not stored verbatim in counters. */
export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Collapse addresses that deliver to the same mailbox, so "a+1@x", "a+2@x" (and Gmail's dotted
 * variants) share one counter. Used only for the mail-bomb cap, never to change who can sign in.
 */
export function canonicalMailbox(email: string): string {
  const [rawLocal = "", domain = ""] = email.trim().toLowerCase().split("@");
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.replaceAll(".", "");
  return `${local}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}
