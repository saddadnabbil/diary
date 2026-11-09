import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/server/auth";

// The auth instance depends on per-request bindings, so build the handlers lazily.
export async function GET(req: Request) {
  return toNextJsHandler(getAuth()).GET(req);
}
export async function POST(req: Request) {
  return toNextJsHandler(getAuth()).POST(req);
}
