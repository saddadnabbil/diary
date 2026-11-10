"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useSettings } from "@/hooks/use-settings";
import { adoptUser } from "@/lib/account";
import { authClient } from "@/lib/auth-client";
import { signOutFlow } from "@/lib/sign-out";
import { startSyncRunner } from "@/lib/sync";
import { CalendarIcon, EntriesIcon, HomeIcon, NextIcon, PlusIcon, SettingsIcon } from "./icons";
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

  // Local-only guest: no account needed.
  const guest = !!settings && !settings.ownerId && settings.storageMode === "local" && settings.onboarded;
  // A device already set up for an account. Shown straight away while the session check runs,
  // so the dashboard does not wait on the network; a missing session still sends the user to sign in.
  const setUpForAccount = !!settings && !!settings.ownerId && settings.onboarded;

  useEffect(() => {
    if (isPending || !settings) return;
    if (!user) {
      if (!guest) router.replace("/welcome");
    } else if (settings.ownerId === user.id && !settings.onboarded) router.replace("/onboarding/storage");
  }, [isPending, settings, user, guest, router]);

  const syncing = !!user && settings?.storageMode === "cloud" && settings.ownerId === user.id;
  useEffect(() => (syncing ? startSyncRunner() : undefined), [syncing]);

  const ready = user
    ? !!settings && settings.ownerId === user.id && settings.onboarded
    : isPending
      ? guest || setUpForAccount
      : guest;
  if (!ready) return <div className="flex-1" aria-busy="true" />;
  return <>{children}</>;
}

/** Entries stay highlighted while reading or writing one. */
const isTabActive = (pathname: string, href: string) =>
  isActive(pathname, href) || (href === "/entries" && pathname.startsWith("/write"));

const COLLAPSED_KEY = "diary.sidebar.collapsed";
const sidebarListeners = new Set<() => void>();

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false; // storage blocked: stay expanded
  }
};

/** Remembered per device. The server render is always expanded, so hydration matches. */
function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(
    (fn) => {
      sidebarListeners.add(fn);
      return () => sidebarListeners.delete(fn);
    },
    readCollapsed,
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0");
    } catch {
      /* not persisted: fine for this visit */
    }
    sidebarListeners.forEach((fn) => fn());
  };
  return [collapsed, set];
}

/** Desktop navigation: a left sidebar that can fold down to icons. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const settings = useSettings();
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  async function signOut() {
    if (await signOutFlow(settings?.storageMode === "cloud")) router.replace("/welcome");
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={cx(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line pb-6 pt-7 transition-[width] duration-200 md:flex",
        collapsed ? "w-[76px] items-center px-3" : "w-[260px] px-5",
      )}
    >
      <div className={cx("flex w-full items-center", collapsed ? "flex-col gap-4" : "justify-between")}>
        {!collapsed && (
          <Link href="/dashboard" className="display px-1 text-[22px] leading-7 tracking-[-0.015em]">
            Diary.
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" aria-label="Diary home" className="display text-[22px] leading-7">
            D.
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 items-center justify-center rounded-full text-fg-2 hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <NextIcon size={18} className={cx("transition-transform", collapsed ? "" : "rotate-180")} />
        </button>
      </div>

      <nav aria-label="Main" className={cx("mt-6 flex flex-col gap-1", collapsed && "w-full items-center")}>
        {TABS.map(({ href, label, Icon }) => {
          const active = isTabActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={cx(
                "flex items-center rounded-xl text-[15px] leading-[22px] transition-colors",
                collapsed ? "size-11 justify-center" : "gap-3 px-3.5 py-2.5",
                active ? "bg-surface font-medium text-fg" : "text-fg-2 hover:bg-surface hover:text-fg",
              )}
            >
              <Icon size={20} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {collapsed ? (
        <Link
          href="/write"
          aria-label="New entry"
          title="New entry"
          className="mt-auto flex size-11 items-center justify-center rounded-full bg-primary text-on-primary hover:opacity-90"
        >
          <PlusIcon size={20} />
        </Link>
      ) : (
        <div className="mt-auto flex w-full flex-col items-stretch gap-2">
          <LinkButton href="/write" className="w-full">
            New entry
          </LinkButton>
          <Link href="/story/new" className="self-center text-[14px] leading-5 text-fg-2 hover:text-fg">
            Add a story
          </Link>
        </div>
      )}

      {!collapsed && (
        <div className="mt-5 flex flex-col gap-1 px-1">
          {settings?.email ? (
            <>
              <p className="truncate text-[13px] leading-[18px] text-fg-3" title={settings.email}>
                {settings.email}
              </p>
              <button type="button" onClick={signOut} className="w-fit text-[14px] leading-5 text-fg-2 hover:text-fg">
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-[18px] text-fg-3">Saved on this device only.</p>
              <Link href="/sign-in" className="w-fit text-[14px] leading-5 text-fg-2 hover:text-fg">
                Sign in to sync
              </Link>
            </>
          )}
        </div>
      )}
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
