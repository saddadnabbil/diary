"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { authClient } from "@/lib/auth-client";

/** Entry point: signed-out visitors go to the welcome page, everyone else to where they left off. */
export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const settings = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (isPending || !settings) return;
    if (!session) router.replace("/welcome");
    else router.replace(settings.onboarded && settings.ownerId === session.user.id ? "/dashboard" : "/onboarding/storage");
  }, [isPending, session, settings, router]);

  return <div className="flex-1" aria-busy="true" />;
}
