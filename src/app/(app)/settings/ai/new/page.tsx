"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Page } from "@/components/page";
import { Button, Chip, cx, Field, PageTitle } from "@/components/ui";
import { db, newId, updateSettings } from "@/lib/db";
import { PRESETS, presetById } from "@/lib/providers";
import { testProvider, type TestState } from "@/lib/test-provider";
import type { PresetId } from "@/lib/types";

export default function AddProviderPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetId>("openai");
  const initial = presetById("openai");
  const [baseURL, setBaseURL] = useState(initial.baseURL);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [makeDefault, setMakeDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  const selected = presetById(preset);

  function choose(id: PresetId) {
    const p = presetById(id);
    setPreset(id);
    setBaseURL(p.baseURL);
    setModel(p.model);
    setTest({ status: "idle" });
  }

  function validate(): string | null {
    if (!/^https:\/\//i.test(baseURL.trim()) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(baseURL.trim())) return "The base URL must start with https://";
    if (!model.trim()) return "Enter a model name.";
    if (!apiKey.trim()) return "Enter your API key.";
    return null;
  }

  async function runTest() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    setTest({ status: "running" });
    setTest(await testProvider({ baseURL: baseURL.trim(), model: model.trim(), apiKey: apiKey.trim(), builtin: false }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    const id = newId();
    await db.providers.add({
      id,
      preset,
      label: preset === "custom" ? (safeHost(baseURL) ?? "Custom") : selected.label,
      baseURL: baseURL.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
      builtin: false,
    });
    if (makeDefault) await updateSettings({ defaultProviderId: id });
    router.replace("/settings/ai");
  }

  return (
    <Page>
      <Link href="/settings/ai" className="text-[15px] leading-6 text-fg-2 hover:text-fg">
        Cancel
      </Link>
      <div className="mt-8">
        <PageTitle>Add provider.</PageTitle>
      </div>

      <form onSubmit={save} className="mt-8 flex flex-col gap-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-[13px] leading-[18px] font-medium text-fg-2">Provider</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p.id} selected={preset === p.id} onClick={() => choose(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <Field id="baseURL" label="Base URL" value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://llm.example.com/v1" autoComplete="off" spellCheck={false} />
        <Field id="model" label="Model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="my-model" autoComplete="off" spellCheck={false} />
        <Field
          id="apiKey"
          label="API key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={selected.keyHint}
          autoComplete="off"
          hint="Stored on this device. It is sent to our server only to make the request, and is never saved there."
        />

        <label className="flex items-center gap-3 text-[15px] leading-6">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          Use this provider for suggestions
        </label>

        {error && (
          <p role="alert" className="text-[13px] leading-[18px] text-fg">
            {error}
          </p>
        )}
        {test.status !== "idle" && test.status !== "running" && (
          <p role="status" className={cx("text-[13px] leading-[18px]", test.status === "ok" ? "text-success" : "text-fg")}>
            {test.message}
          </p>
        )}

        <div className="mt-2 flex flex-col gap-2.5 md:flex-row">
          <Button type="button" variant="secondary" onClick={runTest} disabled={test.status === "running"} className="md:flex-1">
            {test.status === "running" ? "Testing…" : "Test connection"}
          </Button>
          <Button type="submit" className="md:flex-1">
            Save provider
          </Button>
        </div>
      </form>
    </Page>
  );
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
