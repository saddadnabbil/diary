"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Page } from "@/components/page";
import {
  Button,
  Chip,
  Field,
  LinkButton,
  OptionCard,
  PageTitle,
} from "@/components/ui";
import { displayName } from "@/hooks/use-entries";
import { useDefaultProvider, useSettings } from "@/hooks/use-settings";
import { authClient } from "@/lib/auth-client";
import {
  enableCloudSync,
  exportEntries,
  importEntries,
  updateSettings,
  wipeLocal,
} from "@/lib/db";
import { formatShort, formatTime } from "@/lib/dates";
import { signOutFlow } from "@/lib/sign-out";
import { syncNow, useSyncState } from "@/lib/sync";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12" aria-label={title}>
      <h2 className="text-[20px] leading-7 font-medium tracking-[-0.03em]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[15px] leading-6 text-fg-2">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const settings = useSettings();
  const provider = useDefaultProvider();
  const sync = useSyncState();
  const { theme, setTheme } = useTheme();
  // false during SSR/hydration, true afterwards (next-themes only knows the theme on the client)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [message, setMessage] = useState<string | null>(null);
  // null until the user types; the field then shows the saved name.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const nameDraft = nameEdit ?? settings?.displayName ?? "";
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cloud = settings?.storageMode === "cloud";

  async function download() {
    const blob = new Blob([await exportEntries()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    try {
      const n = await importEntries(await file.text());
      setMessage(`Imported ${n} ${n === 1 ? "entry" : "entries"}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not read that file.");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function signOut() {
    if (await signOutFlow(cloud)) router.replace("/welcome");
  }

  async function deleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmEmail }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: unknown;
        };
        setDeleteError(
          typeof data.message === "string"
            ? data.message
            : "Could not delete the account.",
        );
        setDeleting(false);
        return;
      }
      await authClient.signOut().catch(() => undefined);
      await wipeLocal();
      router.replace("/welcome");
    } catch {
      setDeleteError("Could not reach the server.");
      setDeleting(false);
    }
  }

  const lastSynced = settings?.lastSyncedAt
    ? `${formatShort(settings.lastSyncedAt)}, ${formatTime(settings.lastSyncedAt)}`
    : "not yet";

  return (
    <Page>
      <PageTitle>Settings.</PageTitle>

      <Section title="Account.">
        <form
          className="flex items-center justify-between gap-4 border-b border-line py-4"
          onSubmit={(e) => {
            e.preventDefault();
            void updateSettings({ displayName: nameDraft.trim().slice(0, 40) || null }).then(() => {
              setNameEdit(null);
              setMessage("Name saved.");
            });
          }}
        >
          <label htmlFor="display-name" className="text-[16px] leading-6">
            Name
          </label>
          <span className="flex min-w-0 items-center gap-2">
            <input
              id="display-name"
              value={nameDraft}
              onChange={(e) => setNameEdit(e.target.value.slice(0, 40))}
              placeholder={displayName(settings?.email) ?? "Your name"}
              autoComplete="given-name"
              maxLength={40}
              className="min-w-0 rounded-full border border-line bg-bg px-4 py-2 text-right text-[15px] leading-[22px] placeholder:text-fg-3 focus:border-fg focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded-full px-3 py-2 text-[14px] text-fg-2 hover:text-fg">
              Save
            </button>
          </span>
        </form>
        <div className="flex items-center justify-between gap-4 border-b border-line py-4">
          <span className="text-[16px] leading-6">Email</span>
          <span className="truncate text-[15px] leading-[22px] text-fg-3">
            {settings?.email ?? "This device only"}
          </span>
        </div>
        {!settings?.email && (
          <div className="mt-4">
            <p className="text-[15px] leading-6 text-fg-2">
              Sign in to back up your entries and sync them across devices.
            </p>
            <LinkButton href="/sign-in" className="mt-3">
              Sign in to sync
            </LinkButton>
          </div>
        )}
      </Section>

      <Section
        title="Storage."
        description="Choose where your entries live. You can switch at any time."
      >
        <div
          role="radiogroup"
          aria-label="Storage"
          className="grid gap-3 md:grid-cols-2"
        >
          <OptionCard
            selected={cloud}
            title="Cloud sync"
            description="Entries sync across all your devices and are backed up."
            onSelect={() =>
              !cloud &&
              (settings?.email
                ? void enableCloudSync()
                : router.push("/sign-in"))
            }
          />
          <OptionCard
            selected={settings?.storageMode === "local"}
            title="Local only"
            description="Entries stay on this device. Nothing new is sent to our servers."
            onSelect={() => void updateSettings({ storageMode: "local" })}
          />
        </div>
        {cloud ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => void syncNow()}
              disabled={sync.status === "syncing"}
            >
              {sync.status === "syncing" ? "Syncing…" : "Sync now"}
            </Button>
            <p role="status" className="text-[13px] leading-[19px] text-fg-3">
              {sync.message ?? `Last synced: ${lastSynced}`}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-[13px] leading-[19px] text-fg-3">
            Entries you already synced stay in your cloud account until you
            delete it below.
          </p>
        )}
      </Section>

      <Section title="Writing prompts." description="Where your prompts come from. The built-in list needs nothing and sends nothing anywhere.">
        <div role="radiogroup" aria-label="Prompt source" className="grid gap-3 md:grid-cols-2">
          <OptionCard
            selected={!settings?.aiEnabled}
            title="Built-in list"
            description="Curated prompts. Nothing leaves this device."
            onSelect={() => void updateSettings({ aiEnabled: false })}
          />
          <OptionCard
            selected={!!settings?.aiEnabled}
            title="AI model"
            description={`Writes prompts with ${provider?.label ?? "DeepSeek"}. Only the mood and time of day are sent.`}
            onSelect={() => {
              void updateSettings({ aiEnabled: true });
              router.push("/settings/ai");
            }}
          />
        </div>
        {settings?.aiEnabled && (
          <Link href="/settings/ai" className="mt-4 inline-flex text-[14px] leading-5 text-fg-2 underline underline-offset-4 hover:text-fg">
            Manage AI model
          </Link>
        )}
      </Section>

      <Section
        title="Appearance."
        description="Match your system or pick a theme."
      >
        <div className="flex gap-2" role="group" aria-label="Theme">
          {(["system", "light", "dark"] as const).map((t) => (
            <Chip
              key={t}
              selected={mounted && theme === t}
              onClick={() => setTheme(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Data.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            Export entries
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
          >
            Import entries
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
        </div>
        {message && (
          <p
            role="status"
            className="mt-3 text-[13px] leading-[19px] text-fg-2"
          >
            {message}
          </p>
        )}
      </Section>

      {settings?.email && (
        <>
          <div className="mt-12 border-t border-line pt-6">
            <Button variant="ghost" className="-ml-3" onClick={signOut}>
              Sign out
            </Button>
          </div>

          <Section
            title="Delete account."
            description="Permanently removes your account and every entry from our servers. This cannot be undone."
          >
            <div className="flex max-w-md flex-col gap-3">
              <Field
                id="confirm-email"
                label="Type your email to confirm"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={settings?.email ?? "you@example.com"}
              />
              {deleteError && (
                <p role="alert" className="text-[13px] leading-[18px] text-fg">
                  {deleteError}
                </p>
              )}
              <div>
                <Button
                  variant="secondary"
                  onClick={deleteAccount}
                  disabled={
                    deleting ||
                    !settings?.email ||
                    confirmEmail.trim().toLowerCase() !==
                      settings.email.toLowerCase()
                  }
                >
                  {deleting ? "Deleting…" : "Delete account and all entries"}
                </Button>
              </div>
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}
