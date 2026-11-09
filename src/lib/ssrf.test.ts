import { describe, expect, it } from "vitest";
import { assertSafeBaseUrl, UnsafeUrlError } from "./ssrf";

describe("assertSafeBaseUrl", () => {
  it("accepts public https hosts", () => {
    expect(assertSafeBaseUrl("https://api.deepseek.com/v1").hostname).toBe("api.deepseek.com");
    expect(assertSafeBaseUrl("https://generativelanguage.googleapis.com/v1beta/openai/").pathname).toBe("/v1beta/openai/");
  });

  it.each([
    "http://api.example.com/v1",
    "https://localhost/v1",
    "https://foo.local/v1",
    "https://db.internal/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.5/v1",
    "https://172.20.1.1/v1",
    "https://192.168.1.10/v1",
    "https://169.254.169.254/latest/meta-data",
    "https://100.64.0.1/v1",
    "https://[::1]/v1",
    "https://user:pass@api.example.com/v1",
    "https://intranet/v1",
    "not a url",
  ])("rejects %s", (u) => {
    expect(() => assertSafeBaseUrl(u)).toThrow(UnsafeUrlError);
  });

  it("rejects numeric host tricks that normalise to private IPs", () => {
    expect(() => assertSafeBaseUrl("https://2130706433/v1")).toThrow(UnsafeUrlError); // 127.0.0.1
    expect(() => assertSafeBaseUrl("https://0x7f.1/v1")).toThrow(UnsafeUrlError);
  });

  it("allows loopback only when explicitly enabled", () => {
    expect(() => assertSafeBaseUrl("http://localhost:11434/v1")).toThrow(UnsafeUrlError);
    expect(assertSafeBaseUrl("http://localhost:11434/v1", { allowLocal: true }).port).toBe("11434");
  });
});
