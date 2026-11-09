/**
 * Users can register their own OpenAI-compatible endpoint, and our server then
 * calls it. That is a server-side request forgery risk, so only public https
 * hosts are accepted. (Does not defend against DNS rebinding; for hard
 * isolation, resolve and pin the IP at the network edge.)
 */

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".corp"];

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export class UnsafeUrlError extends Error {}

export function assertSafeBaseUrl(raw: string, opts: { allowLocal?: boolean } = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("The base URL is not a valid URL.");
  }
  if (url.username || url.password) throw new UnsafeUrlError("The base URL must not contain credentials.");

  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1";

  if (opts.allowLocal && isLoopback && (url.protocol === "http:" || url.protocol === "https:")) return url;

  if (url.protocol !== "https:") throw new UnsafeUrlError("The base URL must use https.");
  if (host.startsWith("[")) throw new UnsafeUrlError("IPv6 literal hosts are not allowed.");
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError("That host is not allowed.");
  }
  if (isPrivateIPv4(host)) throw new UnsafeUrlError("Private network addresses are not allowed.");
  if (!host.includes(".")) throw new UnsafeUrlError("The base URL must be a public hostname.");
  return url;
}
