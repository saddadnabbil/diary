import "server-only";
import { apiError, isSameOrigin } from "./http";
import { getDb, getEnv, type AppEnv } from "./env";
import type { Db } from "./db";
import { rateLimit } from "./rate-limit";
import { getSessionUser, type SessionUser } from "./session";

export interface Guarded {
  user: SessionUser;
  env: AppEnv;
  db: Db;
}

/**
 * Common gate for signed-in JSON endpoints, in this order:
 * 1. same-origin check (CSRF), 2. valid session, 3. per-user rate limit.
 * Returns a ready-to-send Response when any step fails.
 */
export async function guard(
  req: Request,
  opts: { bucket: string; limit: number; windowSec: number },
): Promise<Guarded | Response> {
  const env = getEnv();
  if (!isSameOrigin(req, env.APP_URL)) return apiError(403, "forbidden", "Cross-origin request blocked.");

  const user = await getSessionUser(req);
  if (!user) return apiError(401, "unauthorized", "Sign in to continue.");

  const db = getDb();
  const rl = await rateLimit(db, `${opts.bucket}:${user.id}`, opts.limit, opts.windowSec);
  if (!rl.allowed) {
    return apiError(429, "rate_limited", "Too many requests. Try again shortly.", { "Retry-After": String(rl.retryAfter) });
  }
  return { user, env, db };
}
