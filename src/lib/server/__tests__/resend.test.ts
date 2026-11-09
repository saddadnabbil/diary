import { describe, expect, it, vi } from "vitest";
import { sendViaResend } from "../resend";

const msg = { from: "Diary <a@b.co>", to: "u@x.co", subject: "s", text: "t", html: "<p>t</p>" };

describe("sendViaResend", () => {
  it("posts the message with a bearer key", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendViaResend("re_secret", msg, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_secret");
    expect(JSON.parse(init.body as string)).toEqual(msg);
  });
  it("throws a generic error that does not leak the key or body", async () => {
    const f = vi.fn(async () => new Response('{"message":"bad re_secret"}', { status: 403 }));
    const err = await sendViaResend("re_secret", msg, f as unknown as typeof fetch).catch((e: Error) => e);
    expect((err as Error).message).toBe("Resend rejected the email (HTTP 403).");
  });
});
