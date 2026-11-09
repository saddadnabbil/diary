import type { Db } from "./db";
import type { ImageType } from "./image-sniff";

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGES_PER_USER = 2000;
export const MAX_TOTAL_BYTES_PER_USER = 500 * 1024 * 1024;

/** The slice of R2Bucket used here, so tests can use an in-memory fake. */
export interface Bucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream } | null>;
  list(options: { prefix: string; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string[]): Promise<void>;
}

export const imageKey = (userId: string, id: string) => `${userId}/${id}`;

export type PutResult = "created" | "exists" | "quota";

/** Store an image once. Images are immutable (ids are random), so a repeat upload is a no-op. */
export async function putImage(db: Db, bucket: Bucket, userId: string, id: string, type: ImageType, bytes: Uint8Array, now = Date.now()): Promise<PutResult> {
  const existing = await db.prepare("SELECT 1 AS x FROM user_images WHERE user_id = ?1 AND id = ?2").bind(userId, id).first();
  if (existing) return "exists";

  const usage = await db
    .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS b FROM user_images WHERE user_id = ?1")
    .bind(userId)
    .first<{ n: number; b: number }>();
  if ((usage?.n ?? 0) >= MAX_IMAGES_PER_USER || (usage?.b ?? 0) + bytes.byteLength > MAX_TOTAL_BYTES_PER_USER) return "quota";

  await bucket.put(imageKey(userId, id), bytes, { httpMetadata: { contentType: type } });
  await db
    .prepare("INSERT OR IGNORE INTO user_images (user_id, id, bytes, content_type, created_at) VALUES (?1, ?2, ?3, ?4, ?5)")
    .bind(userId, id, bytes.byteLength, type, now)
    .run();
  return "created";
}

/** Look up an image owned by this user. Another user's id simply does not exist for them. */
export async function findImage(db: Db, bucket: Bucket, userId: string, id: string) {
  const row = await db.prepare("SELECT content_type FROM user_images WHERE user_id = ?1 AND id = ?2").bind(userId, id).first<{ content_type: string }>();
  if (!row) return null;
  const obj = await bucket.get(imageKey(userId, id));
  return obj ? { body: obj.body, contentType: row.content_type } : null;
}

/** Remove every stored image of a user (account deletion). */
export async function deleteUserImages(bucket: Bucket, userId: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: `${userId}/`, cursor });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
