import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import { sendSignInCode } from "./email";
import { getDb, getEnv, isDev, type AppEnv } from "./env";
import { canonicalMailbox, rateLimit, sha256Hex } from "./rate-limit";

const OTP_EXPIRES_SEC = 600;

function build(env: AppEnv) {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to a random value of at least 32 characters.");
  }
  const secure = !isDev();
  // A misconfigured origin would silently weaken cookies/CSRF checks, so fail closed in production.
  const host = new URL(env.APP_URL).hostname;
  if (secure && !env.APP_URL.startsWith("https://") && host !== "localhost") {
    throw new Error("APP_URL must be an https:// URL in production.");
  }

  return betterAuth({
    appName: "Diary",
    baseURL: env.APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [env.APP_URL],

    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },

    // Built-in limiter, stored in D1 so it is shared by every Worker instance.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        // Requesting a code sends an email: keep it tight per IP.
        "/email-otp/send-verification-otp": { window: 300, max: 5 },
        // Guessing a code: each code also locks after 3 wrong tries (allowedAttempts).
        "/sign-in/email-otp": { window: 300, max: 10 },
      },
    },

    advanced: {
      useSecureCookies: secure,
      cookiePrefix: "diary",
      // Only Cloudflare's header: x-forwarded-for is client-controlled.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure },
    },

    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_EXPIRES_SEC,
        allowedAttempts: 3,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;

          // Per-address cap so nobody can mail-bomb a victim by cycling IPs.
          // The response is identical either way, so this does not reveal anything.
          const key = `otp-email:${await sha256Hex(canonicalMailbox(email))}`;
          const { allowed } = await rateLimit(getDb(), key, 3, 900);
          if (!allowed) return;

          // Do not hold the response open for the email provider.
          getCloudflareContext().ctx.waitUntil(
            sendSignInCode(env, email, otp).catch((e) => console.error("sign-in email failed", e instanceof Error ? e.message : e)),
          );
        },
      }),
    ],
  });
}

const cache = new WeakMap<object, ReturnType<typeof build>>();

/** Auth instance for the current request's bindings (cached per isolate). */
export function getAuth() {
  const env = getEnv();
  let auth = cache.get(env.DB as object);
  if (!auth) {
    auth = build(env);
    cache.set(env.DB as object, auth);
  }
  return auth;
}
