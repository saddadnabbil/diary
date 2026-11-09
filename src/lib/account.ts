import { db, enableCloudSync, ensureSeed, updateSettings, wipeLocal } from "./db";

/**
 * Called whenever a signed-in user is seen on this device. If the data on the device
 * belongs to a different account it is wiped first, so accounts never see each other's entries or API keys.
 * A guest device (used without signing in) is claimed by the account instead: its entries are kept and uploaded.
 * Returns true when a guest's local data was just claimed.
 */
export async function adoptUser(user: { id: string; email: string }): Promise<boolean> {
  await ensureSeed();
  const settings = await db.settings.get("me");
  const guest = !settings?.ownerId && !!settings && (settings.onboarded || (await db.entries.count()) > 0);
  if (settings?.ownerId && settings.ownerId !== user.id) await wipeLocal();
  await updateSettings({ ownerId: user.id, email: user.email });
  if (guest) await enableCloudSync();
  return guest;
}

/** True when the signed-in account already has entries in the cloud (a returning user on a new device). */
export async function hasCloudData(): Promise<boolean> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ since: 0, changes: [], limit: 1 }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { changes?: unknown[] };
    return (data.changes?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/** An account younger than this, with nothing in the cloud yet, is a new user who should see onboarding. */
const NEW_ACCOUNT_MS = 60 * 60 * 1000;

/**
 * Decide where a signed-in user starts. A guest device that was just claimed goes to its diary.
 * A brand new account goes through onboarding; anyone else goes straight to their diary in cloud mode.
 */
export async function resolveStart(user: { createdAt: Date | string }, claimedGuest: boolean): Promise<"/dashboard" | "/onboarding/storage"> {
  if (claimedGuest) return (await db.settings.get("me"))?.onboarded ? "/dashboard" : "/onboarding/storage";
  const isNew = Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_MS;
  if (isNew && !(await hasCloudData())) return "/onboarding/storage";
  await updateSettings({ storageMode: "cloud", onboarded: true, syncCursor: 0 });
  return "/dashboard";
}

/** Guest: used without an account. Entries stay on this device only. */
export async function isGuest(): Promise<boolean> {
  const s = await db.settings.get("me");
  return !!s && !s.ownerId && s.storageMode === "local" && s.onboarded;
}
