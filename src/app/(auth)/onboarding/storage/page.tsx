"use client";

import { useRouter } from "next/navigation";
import { Button, OptionCard } from "@/components/ui";
import { useSettings } from "@/hooks/use-settings";
import { authClient } from "@/lib/auth-client";
import { updateSettings } from "@/lib/db";

export default function StoragePage() {
  const router = useRouter();
  const settings = useSettings();
  const mode = settings?.storageMode ?? "cloud";

  // Cloud needs an account, so sign in first. Local works without one.
  async function next() {
    if (mode === "cloud") {
      const { data } = await authClient.getSession();
      if (!data) return router.push("/sign-in?new=1");
    }
    router.push("/onboarding/ai");
  }

  return (
    <>
      <p className="text-[14px] leading-5 text-fg-3">Step 1 of 2</p>
      <h1 className="display mt-4 text-[28px] leading-8">Where should your diary live?</h1>
      <p className="mt-3 text-[17px] leading-[26px] text-fg-2">You can change this later in Settings.</p>

      <div role="radiogroup" aria-label="Storage" className="mt-8 flex flex-col gap-3">
        <OptionCard
          selected={mode === "cloud"}
          title="Cloud sync"
          tag="Recommended"
          description="Entries sync across all your devices and are backed up."
          onSelect={() => void updateSettings({ storageMode: "cloud" })}
        />
        <OptionCard
          selected={mode === "local"}
          title="Local only"
          description="Entries stay on this device. Nothing is stored on our servers."
          onSelect={() => void updateSettings({ storageMode: "local" })}
        />
      </div>

      <div className="mt-auto pt-10 md:mt-0 md:pt-8">
        <Button className="w-full" onClick={next} disabled={!settings}>
          Continue
        </Button>
      </div>
    </>
  );
}
