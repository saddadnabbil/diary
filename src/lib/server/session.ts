import "server-only";
import { getAuth } from "./auth";

export interface SessionUser {
  id: string;
  email: string;
}

/** The signed-in user for this request, or null. Verified server-side against the session table. */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const session = await getAuth().api.getSession({ headers: req.headers });
  return session ? { id: session.user.id, email: session.user.email } : null;
}
