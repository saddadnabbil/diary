"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";
import { isGuest, resolveStart } from "@/lib/account";
import { authClient } from "@/lib/auth-client";

/** Entry point: signed-out visitors go to the welcome page, everyone else to where they left off. */
export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const settings = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (isPending || !settings) return;
    if (!session) void isGuest().then((guest) => router.replace(guest ? "/dashboard" : "/welcome"));
    else if (settings.onboarded && settings.ownerId === session.user.id) router.replace("/dashboard");
    else void resolveStart(session.user, false).then(router.replace);
  }, [isPending, session, settings, router]);

  return <div className="flex-1" aria-busy="true" />;
}
