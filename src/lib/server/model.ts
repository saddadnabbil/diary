import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError } from "ai";
import { z } from "zod";
import { assertSafeBaseUrl, UnsafeUrlError } from "@/lib/ssrf";
import { isDev, type AppEnv } from "./env";

export const ProviderInput = z.object({
  baseURL: z.string().min(1).max(300),
  model: z.string().min(1).max(120),
  apiKey: z.string().min(1).max(600),
});
export type ProviderInput = z.infer<typeof ProviderInput>;

export class ModelConfigError extends Error {
  constructor(
    public code: "no_default_key" | "bad_url",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Build a chat model. No provider given means the built-in default:
 * DeepSeek through the server's own key.
 */
export function resolveModel(env: AppEnv, provider?: ProviderInput) {
  if (!provider) {
    const apiKey = env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new ModelConfigError("no_default_key", "The default model is not configured on this server.");
    return createOpenAICompatible({
      name: "deepseek",
      baseURL: "https://api.deepseek.com/v1",
      apiKey,
    })(env.DEEPSEEK_MODEL ?? "deepseek-chat");
  }
  let url: URL;
  try {
    url = assertSafeBaseUrl(provider.baseURL, { allowLocal: isDev() });
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw new ModelConfigError("bad_url", e.message);
    throw e;
  }
  return createOpenAICompatible({
    name: "custom",
    baseURL: url.toString().replace(/\/+$/, ""),
    apiKey: provider.apiKey,
  })(provider.model);
}

/** Turn a provider failure into a message that is safe to show (never echoes keys). */
export function describeModelError(e: unknown): { code: string; message: string } {
  if (e instanceof ModelConfigError) return { code: e.code, message: e.message };
  if (APICallError.isInstance(e)) {
    if (e.statusCode === 401 || e.statusCode === 403) return { code: "auth", message: "The provider rejected the API key." };
    if (e.statusCode === 404) return { code: "not_found", message: "Model or base URL not found." };
    if (e.statusCode === 429) return { code: "rate_limited", message: "The provider is rate limiting requests." };
    return { code: "provider_error", message: `The provider returned an error (${e.statusCode ?? "unknown"}).` };
  }
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return { code: "timeout", message: "The provider took too long to respond." };
  }
  return { code: "unknown", message: "Could not get a response from the provider." };
}
