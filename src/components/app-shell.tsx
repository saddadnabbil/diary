"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSettings } from "@/hooks/use-settings";
import { adoptUser } from "@/lib/account";
import { authClient } from "@/lib/auth-client";
import { signOutFlow } from "@/lib/sign-out";
import { startSyncRunner } from "@/lib/sync";
import { CalendarIcon, EntriesIcon, HomeIcon, PlusIcon, SettingsIcon } from "./icons";
import { cx, LinkButton } from "./ui";

const TABS = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/entries", label: "Entries", Icon: EntriesIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/**
 * Guards every app page: requires a real session, finishes onboarding,
 * claims the device for the signed-in account and keeps cloud entries in sync.
 */
export function AppGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const settings = useSettings();
  const router = useRouter();
  const user = session?.user;

  useEffect(() => {
    if (user) void adoptUser({ id: user.id, email: user.email });
  }, [user]);

  useEffect(() => {
    if (isPending || !settings) return;
    if (!user) router.replace("/welcome");
    else if (settings.ownerId === user.id && !settings.onboarded) router.replace("/onboarding/storage");
  }, [isPending, settings, user, router]);

  const syncing = !!user && settings?.storageMode === "cloud" && settings.ownerId === user.id;
  useEffect(() => (syncing ? startSyncRunner() : undefined), [syncing]);

  const ready = !!user && !!settings && settings.ownerId === user.id && settings.onboarded;
  if (!ready) return <div className="flex-1" aria-busy="true" />;
  return <>{children}</>;
}

/** Entries stay highlighted while reading or writing one. */
const isTabActive = (pathname: string, href: string) =>
  isActive(pathname, href) || (href === "/entries" && pathname.startsWith("/write"));

/** Desktop navigation: a fixed left sidebar. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useSettings();

  async function signOut() {
    if (await signOutFlow(settings?.storageMode === "cloud")) router.replace("/welcome");
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line px-5 pb-6 pt-7 md:flex">
      <Link href="/dashboard" className="display px-1 text-[22px] leading-7 tracking-[-0.015em]">
        Diary.
      </Link>
      <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
        {TABS.map(({ href, label, Icon }) => {
          const active = isTabActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] leading-[22px] transition-colors",
                active ? "bg-surface font-medium text-fg" : "text-fg-2 hover:bg-surface hover:text-fg",
              )}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
      <LinkButton href="/write" className="mt-auto w-full">
        New entry
      </LinkButton>
      <div className="mt-5 flex flex-col gap-1 px-1">
        <p className="truncate text-[13px] leading-[18px] text-fg-3" title={settings?.email ?? undefined}>
          {settings?.email}
        </p>
        <button type="button" onClick={signOut} className="w-fit text-[14px] leading-5 text-fg-2 hover:text-fg">
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const item = ({ href, label, Icon }: (typeof TABS)[number]) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cx("flex w-16 flex-col items-center gap-1 pt-0.5 text-[11px] leading-[14px]", active ? "text-fg font-medium" : "text-fg-3")}
      >
        <Icon size={24} />
        {label}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Main (mobile)"
      className="md:hidden sticky bottom-0 z-10 flex items-start justify-between border-t border-line bg-bg px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      {item(TABS[0])}
      {item(TABS[1])}
      <Link
        href="/write"
        aria-label="New entry"
        className="-mt-0.5 flex size-[52px] items-center justify-center rounded-full bg-primary text-on-primary transition-opacity hover:opacity-90"
      >
        <PlusIcon size={22} />
      </Link>
      {item(TABS[2])}
      {item(TABS[3])}
    </nav>
  );
}
