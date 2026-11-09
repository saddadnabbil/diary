import { z } from "zod";
import { guard } from "@/lib/server/guard";
import { apiError, readJson } from "@/lib/server/http";
import { deleteUserImages, type Bucket } from "@/lib/server/image-store";
import { deleteAccountData } from "@/lib/server/sync-store";

const Body = z.object({ confirm: z.string().min(3).max(320) });

/** Permanently deletes the account and every entry. The caller must type their email to confirm. */
export async function DELETE(req: Request) {
  const g = await guard(req, { bucket: "account-delete", limit: 3, windowSec: 3600 });
  if (g instanceof Response) return g;

  const body = await readJson(req, 4096);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.value);
  if (!parsed.success || parsed.data.confirm.trim().toLowerCase() !== g.user.email.toLowerCase()) {
    return apiError(400, "confirmation_mismatch", "Type your email address to confirm.");
  }

  await deleteUserImages(g.env.IMAGES as unknown as Bucket, g.user.id);
  await deleteAccountData(g.db, g.user.id, g.user.email);
  return new Response(null, { status: 204 });
}
