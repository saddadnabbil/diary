import { authClient } from "./auth-client";
import { db, wipeLocal } from "./db";
import { syncNow } from "./sync";

/**
 * Sign out of this device. In cloud mode everything is pushed first and the local copy is then
 * erased; in local mode the entries stay (they exist nowhere else), so the user must confirm.
 * Returns false when the user backs out.
 */
export async function signOutFlow(cloud: boolean): Promise<boolean> {
  if (cloud) {
    await syncNow();
    const unsynced = await db.entries.where("dirty").equals(1).count();
    if (unsynced > 0 && !window.confirm(`${unsynced} change${unsynced === 1 ? " has" : "s have"} not synced yet and will be lost. Sign out anyway?`)) return false;
  } else if (!window.confirm("Your entries are stored only on this device. They stay here after you sign out, but nowhere else. Sign out?")) {
    return false;
  }
  await authClient.signOut();
  if (cloud) await wipeLocal();
  return true;
}
