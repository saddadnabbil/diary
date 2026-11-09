import { guard } from "@/lib/server/guard";
import { apiError, json, readBytes } from "@/lib/server/http";
import { findImage, MAX_IMAGE_BYTES, putImage, type Bucket } from "@/lib/server/image-store";
import { isImageType, sniffImage } from "@/lib/server/image-sniff";

const ID = /^[A-Za-z0-9_-]{8,64}$/;
type Ctx = { params: Promise<{ id: string }> };

/** Upload one image. The file type is decided by its bytes, not by the headers the client sends. */
export async function PUT(req: Request, { params }: Ctx) {
  const g = await guard(req, { bucket: "image-put", limit: 60, windowSec: 60 });
  if (g instanceof Response) return g;
  const { id } = await params;
  if (!ID.test(id)) return apiError(400, "bad_request", "Invalid image id.");

  const declared = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? null;
  if (!isImageType(declared)) return apiError(415, "unsupported_media_type", "Only PNG, JPEG, WebP and GIF are accepted.");

  const body = await readBytes(req, MAX_IMAGE_BYTES);
  if (!body.ok) return body.response;
  if (sniffImage(body.bytes) !== declared) return apiError(415, "unsupported_media_type", "The file is not the image type it claims to be.");

  const result = await putImage(g.db, g.env.IMAGES as unknown as Bucket, g.user.id, id, declared, body.bytes);
  if (result === "quota") return apiError(403, "quota", "Image storage limit reached.");
  return json({ ok: true }, result === "created" ? 201 : 200);
}

/** Download one of your own images. */
export async function GET(req: Request, { params }: Ctx) {
  const g = await guard(req, { bucket: "image-get", limit: 300, windowSec: 60 });
  if (g instanceof Response) return g;
  const { id } = await params;
  if (!ID.test(id)) return apiError(400, "bad_request", "Invalid image id.");

  const image = await findImage(g.db, g.env.IMAGES as unknown as Bucket, g.user.id, id);
  if (!image) return apiError(404, "not_found", "Image not found.");
  return new Response(image.body, {
    headers: {
      "content-type": image.contentType,
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      // Images never change for a given id, but they are private to the account.
      "cache-control": "private, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
