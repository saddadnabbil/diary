/** Small helpers shared by API routes. Pure: no Cloudflare imports, so they are testable. */

export const json = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, { status, headers });

export const apiError = (status: number, error: string, message: string, headers?: HeadersInit) =>
  json({ error, message }, status, headers);

/**
 * Client IP as set by Cloudflare. `x-forwarded-for` is client-controlled, so it is
 * never used in production. Outside production (no Cloudflare in front) we fall back to loopback.
 */
export function clientIp(req: Request, production: boolean): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  return production ? "unknown" : "127.0.0.1";
}

/**
 * CSRF defence for state-changing requests, on top of SameSite=Lax cookies:
 * the Origin header must match this app. Falls back to Sec-Fetch-Site for clients that omit Origin.
 */
export function isSameOrigin(req: Request, appUrl: string): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new Set([new URL(req.url).origin]);
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      /* APP_URL unset/invalid: only the request origin is accepted */
    }
    return allowed.has(origin);
  }
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

export type JsonResult = { ok: true; value: unknown } | { ok: false; response: Response };

/**
 * Read a JSON body with a hard size cap. The cap is enforced while streaming, so a
 * chunked upload with no Content-Length cannot make the Worker buffer an arbitrarily large body.
 */
export async function readJson(req: Request, maxBytes: number): Promise<JsonResult> {
  const tooLarge = { ok: false as const, response: apiError(413, "too_large", "Request is too large.") };
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: apiError(415, "unsupported_media_type", "Send JSON.") };
  }
  if (Number(req.headers.get("content-length") ?? "0") > maxBytes) return tooLarge;

  const chunks: Uint8Array[] = [];
  let received = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return tooLarge;
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: apiError(400, "bad_request", "Invalid JSON.") };
  }
}

export type BytesResult = { ok: true; bytes: Uint8Array } | { ok: false; response: Response };

/** Read a raw body with a hard cap, enforced while streaming. */
export async function readBytes(req: Request, maxBytes: number): Promise<BytesResult> {
  const tooLarge = { ok: false as const, response: apiError(413, "too_large", "File is too large.") };
  if (Number(req.headers.get("content-length") ?? "0") > maxBytes) return tooLarge;
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return tooLarge;
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return { ok: true, bytes };
}
