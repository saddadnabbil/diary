import { authClient } from "./auth-client";

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

interface AuthError {
  status?: number;
  code?: string;
  message?: string;
}

/** Turn an auth error into something safe and helpful to show. */
export function friendlyAuthError(error: AuthError | null | undefined, fallback: string): string {
  if (!error) return fallback;
  if (error.status === 429) return error.message || "Too many attempts. Wait a few minutes and try again.";
  switch (error.code) {
    case "INVALID_OTP":
      return "That code is not right.";
    case "OTP_EXPIRED":
      return "That code has expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many wrong attempts. Request a new code.";
    default:
      return fallback;
  }
}

export async function requestCode(email: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: "sign-in" });
    return error ? { ok: false, message: friendlyAuthError(error, "Could not send the code. Try again.") } : { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
}

export async function verifyCode(email: string, code: string): Promise<{ ok: boolean; message?: string }> {
  if (!/^\d{6}$/.test(code)) return { ok: false, message: "Enter the 6-digit code." };
  try {
    const { error } = await authClient.signIn.emailOtp({ email: email.trim().toLowerCase(), otp: code });
    return error ? { ok: false, message: friendlyAuthError(error, "That code did not work.") } : { ok: true };
  } catch {
    return { ok: false, message: "Could not reach the server. Check your connection." };
  }
}
