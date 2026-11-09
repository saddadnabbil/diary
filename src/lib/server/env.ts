import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Db } from "./db";

/** Bindings and secrets. Secrets are optional in the type so a missing one is handled, not assumed. */
export type AppEnv = Omit<CloudflareEnv, "APP_URL" | "EMAIL_FROM" | "BETTER_AUTH_SECRET"> & {
  APP_URL: string;
  EMAIL_FROM: string;
  BETTER_AUTH_SECRET?: string;
  RESEND_API_KEY?: string;
  /** "true" to really send email in development (otherwise the code is only printed). */
  SEND_REAL_EMAIL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
};

export const getEnv = (): AppEnv => getCloudflareContext().env as unknown as AppEnv;
export const getDb = (): Db => getEnv().DB as unknown as Db;
export const isDev = () => process.env.NODE_ENV === "development";
