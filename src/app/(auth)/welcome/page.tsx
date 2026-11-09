import type { Metadata } from "next";
import { SuggestionCard } from "@/components/suggestions";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return (
    <>
      <p className="display text-[22px] leading-7 tracking-[-0.015em] md:hidden">Diary.</p>
      <h1 className="display mt-14 md:mt-0 text-[44px] leading-[48px] tracking-[-0.075em]">Write it down.</h1>
      <p className="mt-4 text-[18px] leading-7 text-fg-2">
        A quiet place to think. With gentle prompts when you do not know where to start.
      </p>

      <div className="mt-auto flex flex-col gap-8 pt-10">
        <SuggestionCard suggestion={{ category: "Today’s prompt", text: "What small thing made today a little easier?" }} />
        <div className="flex flex-col gap-2.5">
          <LinkButton href="/sign-in?new=1" className="w-full">
            Get started
          </LinkButton>
          <LinkButton href="/sign-in" variant="secondary" className="w-full">
            I already have an account
          </LinkButton>
        </div>
      </div>
    </>
  );
}
