import "server-only";
import { isDev, type AppEnv } from "./env";
import { sendViaResend } from "./resend";

/**
 * Sends the sign-in code with Resend.
 * - Production: RESEND_API_KEY is required.
 * - Development: the code is printed to the server console and nothing is sent, unless
 *   SEND_REAL_EMAIL=true and RESEND_API_KEY are both set (to try real delivery locally).
 * The code is never logged outside development.
 */
export async function sendSignInCode(env: AppEnv, to: string, otp: string): Promise<void> {
  const real = !isDev() || (env.SEND_REAL_EMAIL === "true" && !!env.RESEND_API_KEY);
  if (isDev()) console.log(`[dev] sign-in code for ${to}: ${otp}`);
  if (!real) return;
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured.");

  await sendViaResend(env.RESEND_API_KEY, {
    from: env.EMAIL_FROM,
    to,
    subject: `Your Diary code: ${otp}`,
    text: [
      `Your Diary sign-in code is ${otp}.`,
      "",
      "It expires in 10 minutes. If you did not ask for it, you can ignore this email.",
    ].join("\n"),
    html: `<p style="font:16px/1.5 system-ui,sans-serif">Your Diary sign-in code is</p>
<p style="font:600 32px/1.2 ui-monospace,monospace;letter-spacing:6px;margin:8px 0">${otp}</p>
<p style="font:14px/1.5 system-ui,sans-serif;color:#5d5d5d">It expires in 10 minutes. If you did not ask for it, you can ignore this email.</p>`,
  });
}
