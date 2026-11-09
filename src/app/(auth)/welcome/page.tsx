"use client";

import { useRouter } from "next/navigation";
import { SuggestionCard } from "@/components/suggestions";
import { Button, LinkButton } from "@/components/ui";
import { isGuest } from "@/lib/account";
import { ensureSeed, updateSettings } from "@/lib/db";

export default function WelcomePage() {
  const router = useRouter();

  // No account needed to start: entries stay on this device until the user chooses to sign in and sync.
  async function startGuest() {
    await ensureSeed(); // the settings row must exist before it can be updated
    if (await isGuest()) return router.push("/dashboard");
    await updateSettings({ storageMode: "local", onboarded: false });
    router.push("/onboarding/storage");
  }

  return (
    <>
      <p className="display text-[22px] leading-7 tracking-[-0.015em] md:hidden">Diary.</p>
      <h1 className="display mt-10 md:mt-0 text-[44px] leading-[48px] tracking-[-0.075em]">Write it down.</h1>
      <p className="mt-4 text-[18px] leading-7 text-fg-2">
        A quiet place to think. With gentle prompts when you do not know where to start.
      </p>

      <div className="mt-auto flex flex-col gap-8 pt-10">
        <SuggestionCard suggestion={{ category: "Today’s prompt", text: "What small thing made today a little easier?" }} />
        <div className="flex flex-col gap-2.5">
          <Button className="w-full" onClick={startGuest}>
            Start writing
          </Button>
          <LinkButton href="/sign-in?new=1" variant="secondary" className="w-full">
            Create an account to sync
          </LinkButton>
          <LinkButton href="/sign-in" variant="ghost" className="w-full">
            I already have an account
          </LinkButton>
        </div>
      </div>
    </>
  );
}
