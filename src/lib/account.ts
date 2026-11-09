import { db, ensureSeed, updateSettings, wipeLocal } from "./db";

/**
 * Called whenever a signed-in user is seen on this device. If the data on the device
 * belongs to a different account it is wiped first, so accounts never see each other's entries or API keys.
 */
export async function adoptUser(user: { id: string; email: string }): Promise<void> {
  await ensureSeed();
  const settings = await db.settings.get("me");
  if (settings?.ownerId && settings.ownerId !== user.id) await wipeLocal();
  await updateSettings({ ownerId: user.id, email: user.email });
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
