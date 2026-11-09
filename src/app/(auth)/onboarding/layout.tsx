"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

/** Onboarding steps need a signed-in user. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) router.replace("/welcome");
  }, [isPending, session, router]);

  if (!session) return <div className="flex-1" aria-busy="true" />;
  return <>{children}</>;
}
