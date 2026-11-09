import { guard } from "@/lib/server/guard";
import { apiError, json, readJson } from "@/lib/server/http";
import { applyChanges, pullChanges, QuotaError } from "@/lib/server/sync-store";
import { SyncRequest } from "@/lib/sync-schema";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** One round trip: push local changes, then pull everything newer than `since`. */
export async function POST(req: Request) {
  const g = await guard(req, { bucket: "sync", limit: 120, windowSec: 60 });
  if (g instanceof Response) return g;

  const body = await readJson(req, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = SyncRequest.safeParse(body.value);
  if (!parsed.success) return apiError(400, "bad_request", "Invalid sync request.");

  try {
    await applyChanges(g.db, g.user.id, parsed.data.changes);
  } catch (e) {
    if (e instanceof QuotaError) return apiError(403, "quota", e.message);
    throw e;
  }
  return json(await pullChanges(g.db, g.user.id, parsed.data.since, parsed.data.limit));
}
