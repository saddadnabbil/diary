import type { LlmProvider } from "./types";

export type TestState = { status: "idle" | "running" | "ok" | "error"; message?: string };

/** Calls "Test connection". The built-in provider is tested with no credentials (server key). */
export async function testProvider(p: Pick<LlmProvider, "baseURL" | "model" | "apiKey" | "builtin">): Promise<TestState> {
  try {
    const res = await fetch("/api/providers/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: p.builtin ? undefined : { baseURL: p.baseURL, model: p.model, apiKey: p.apiKey } }),
    });
    const data = (await res.json()) as { ok?: boolean; latencyMs?: number; message?: string };
    return data.ok
      ? { status: "ok", message: `Connected in ${data.latencyMs} ms.` }
      : { status: "error", message: data.message ?? "Connection failed." };
  } catch {
    return { status: "error", message: "Could not reach the server." };
  }
}
