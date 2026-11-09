"use client";

import Link from "next/link";
import { useState } from "react";
import { BackIcon } from "@/components/icons";
import { Page } from "@/components/page";
import { Button, Chip, cx, LinkButton, PageTitle } from "@/components/ui";
import { useProviders, useSettings } from "@/hooks/use-settings";
import { db, updateSettings } from "@/lib/db";
import { testProvider, type TestState } from "@/lib/test-provider";
import type { LlmProvider } from "@/lib/types";

export default function AiSettingsPage() {
  const settings = useSettings();
  const providers = useProviders();
  const [tests, setTests] = useState<Record<string, TestState>>({});

  async function run(p: LlmProvider) {
    setTests((t) => ({ ...t, [p.id]: { status: "running" } }));
    const result = await testProvider(p);
    setTests((t) => ({ ...t, [p.id]: result }));
  }

  async function remove(p: LlmProvider) {
    await db.providers.delete(p.id);
    if (settings?.defaultProviderId === p.id) await updateSettings({ defaultProviderId: "deepseek-default" });
  }

  const sorted = [...(providers ?? [])].sort((a, b) => Number(b.builtin) - Number(a.builtin));

  return (
    <Page>
      <Link href="/settings" aria-label="Back to settings" className="-ml-1 inline-flex rounded-full p-1 text-fg hover:bg-surface-hover">
        <BackIcon />
      </Link>
      <div className="mt-8">
        <PageTitle sub="Choose the model that writes your prompts.">AI suggestions.</PageTitle>
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        {sorted.map((p) => {
          const isDefault = settings?.defaultProviderId === p.id;
          const t = tests[p.id];
          return (
            <li
              key={p.id}
              className={cx("flex flex-col gap-3.5 rounded-[20px] bg-bg px-5 py-[18px]", isDefault ? "border-[1.5px] border-fg" : "border border-line")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[17px] leading-6 font-medium">{p.label}</p>
                  <p className="truncate text-[13px] leading-[18px] text-fg-3">
                    {p.model}
                    {p.builtin ? "  ·  Included, no key needed" : p.apiKey ? `  ·  Key ending ${p.apiKey.slice(-4)}` : ""}
                  </p>
                </div>
                {isDefault && <Chip selected>Default</Chip>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => run(p)} disabled={t?.status === "running"}>
                  {t?.status === "running" ? "Testing…" : "Test connection"}
                </Button>
                {!isDefault && (
                  <Button variant="secondary" onClick={() => updateSettings({ defaultProviderId: p.id })}>
                    Set default
                  </Button>
                )}
                {!p.builtin && (
                  <Button variant="ghost" onClick={() => remove(p)}>
                    Remove
                  </Button>
                )}
              </div>
              {t && t.status !== "idle" && t.status !== "running" && (
                <p role="status" className={cx("text-[13px] leading-[18px]", t.status === "ok" ? "text-success" : "text-fg")}>
                  {t.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <LinkButton href="/settings/ai/new">Add provider</LinkButton>
      </div>

      <section className="mt-12 border-t border-line pt-6" aria-label="Privacy">
        <label className="flex cursor-pointer items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={!!settings?.personalize}
            aria-label="Use recent entry titles for better prompts"
            onClick={() => updateSettings({ personalize: !settings?.personalize })}
            className={cx(
              "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
              settings?.personalize ? "bg-primary" : "bg-line",
            )}
          >
            <span
              className={cx(
                "size-5 rounded-full transition-transform",
                settings?.personalize ? "translate-x-4 bg-on-primary" : "bg-bg",
              )}
            />
          </button>
          <span>
            <span className="block text-[16px] leading-6">Personalize with recent titles</span>
            <span className="block text-[13px] leading-[19px] text-fg-3">
              Sends up to 3 entry titles to the model for more relevant prompts. Entry text is never sent. Off by default.
            </span>
          </span>
        </label>
      </section>
    </Page>
  );
}
