"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, OptionCard } from "@/components/ui";
import { updateSettings } from "@/lib/db";

export default function OnboardingAiPage() {
  const router = useRouter();
  const [choice, setChoice] = useState<"default" | "own">("default");

  async function finish() {
    await updateSettings({ onboarded: true });
    router.push(choice === "own" ? "/settings/ai/new" : "/dashboard");
  }

  return (
    <>
      <p className="text-[14px] leading-5 text-fg-3">Step 2 of 2</p>
      <h1 className="display mt-4 text-[28px] leading-8">Pick your writing assistant.</h1>
      <p className="mt-3 text-[17px] leading-[26px] text-fg-2">
        It suggests what to write about. Your entries are never sent in full.
      </p>

      <div role="radiogroup" aria-label="Writing assistant" className="mt-8 flex flex-col gap-3">
        <OptionCard
          selected={choice === "default"}
          title="DeepSeek"
          tag="Default"
          description="Default model. Works out of the box, no key needed."
          onSelect={() => setChoice("default")}
        />
        <OptionCard
          selected={choice === "own"}
          title="Use my own model"
          description="Add OpenAI, Anthropic, Google or any OpenAI-compatible API."
          onSelect={() => setChoice("own")}
        />
      </div>

      <div className="mt-auto pt-10 md:mt-0 md:pt-8">
        <Button className="w-full" onClick={finish}>
          {choice === "own" ? "Add my model" : "Start writing"}
        </Button>
      </div>
    </>
  );
}
