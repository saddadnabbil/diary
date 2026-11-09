import { describe, expect, it } from "vitest";
import { clientIp, isSameOrigin, readJson } from "../http";

const req = (url: string, init: RequestInit = {}) => new Request(url, init);

describe("isSameOrigin", () => {
  const APP = "https://diary.example.com";
  it("accepts a matching Origin", () => {
    expect(isSameOrigin(req(`${APP}/api/sync`, { method: "POST", headers: { origin: APP } }), APP)).toBe(true);
  });
  it("rejects a foreign Origin", () => {
    expect(isSameOrigin(req(`${APP}/api/sync`, { method: "POST", headers: { origin: "https://evil.example" } }), APP)).toBe(false);
  });
  it("rejects look-alike origins", () => {
    for (const o of ["https://diary.example.com.evil.io", "http://diary.example.com", "null"]) {
      expect(isSameOrigin(req(`${APP}/x`, { method: "POST", headers: { origin: o } }), APP)).toBe(false);
    }
  });
  it("falls back to Sec-Fetch-Site when Origin is absent", () => {
    expect(isSameOrigin(req(`${APP}/x`, { method: "POST", headers: { "sec-fetch-site": "same-origin" } }), APP)).toBe(true);
    expect(isSameOrigin(req(`${APP}/x`, { method: "POST", headers: { "sec-fetch-site": "cross-site" } }), APP)).toBe(false);
  });
  it("rejects when there is no evidence at all", () => {
    expect(isSameOrigin(req(`${APP}/x`, { method: "POST" }), APP)).toBe(false);
  });
});

describe("clientIp", () => {
  it("uses only Cloudflare's header in production and ignores x-forwarded-for", () => {
    const r = req("https://x.test", { headers: { "x-forwarded-for": "6.6.6.6", "cf-connecting-ip": "1.2.3.4" } });
    expect(clientIp(r, true)).toBe("1.2.3.4");
    expect(clientIp(req("https://x.test", { headers: { "x-forwarded-for": "6.6.6.6" } }), true)).toBe("unknown");
  });
  it("falls back to loopback in development", () => {
    expect(clientIp(req("https://x.test"), false)).toBe("127.0.0.1");
  });
});

describe("readJson", () => {
  const post = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
    req("https://x.test", { method: "POST", body, headers });

  it("parses valid JSON", async () => {
    const r = await readJson(post('{"a":1}'), 100);
    expect(r).toEqual({ ok: true, value: { a: 1 } });
  });
  it("rejects non-JSON content types", async () => {
    const r = await readJson(post("{}", { "content-type": "text/plain" }), 100);
    expect(r.ok === false && r.response.status).toBe(415);
  });
  it("rejects oversized bodies", async () => {
    const r = await readJson(post(JSON.stringify({ a: "x".repeat(500) })), 100);
    expect(r.ok === false && r.response.status).toBe(413);
  });
  it("caps chunked bodies that declare no length", async () => {
    const stream = new ReadableStream({
      start(c) {
        for (let i = 0; i < 20; i++) c.enqueue(new TextEncoder().encode("x".repeat(50)));
        c.close();
      },
    });
    const r = await readJson(
      new Request("https://x.test", { method: "POST", body: stream, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit),
      200,
    );
    expect(r.ok === false && r.response.status).toBe(413);
  });
  it("rejects malformed JSON", async () => {
    const r = await readJson(post("{nope"), 100);
    expect(r.ok === false && r.response.status).toBe(400);
  });
});
