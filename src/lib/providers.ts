import type { LlmProvider, PresetId } from "./types";

export interface Preset {
  id: PresetId;
  label: string;
  baseURL: string;
  model: string;
  keyHint: string;
}

/** Every preset speaks the OpenAI-compatible chat API, so one client covers them all. */
export const PRESETS: Preset[] = [
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat", keyHint: "sk-…" },
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-5-mini", keyHint: "sk-…" },
  { id: "anthropic", label: "Anthropic", baseURL: "https://api.anthropic.com/v1/", model: "claude-haiku-5-5", keyHint: "sk-ant-…" },
  { id: "google", label: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.5-flash", keyHint: "AIza…" },
  { id: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyHint: "gsk_…" },
  { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", model: "openai/gpt-5-mini", keyHint: "sk-or-…" },
  { id: "custom", label: "Custom (OpenAI-compatible)", baseURL: "", model: "", keyHint: "API key" },
];

export const DEFAULT_PROVIDER_ID = "deepseek-default";

/** Built-in default: DeepSeek via the server's own key, so it works out of the box. */
export const BUILTIN_PROVIDER: LlmProvider = {
  id: DEFAULT_PROVIDER_ID,
  preset: "deepseek",
  label: "DeepSeek",
  baseURL: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  apiKey: "",
  builtin: true,
};

export const presetById = (id: PresetId): Preset => PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];
