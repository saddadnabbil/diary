export interface ResendMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Send one email through the Resend HTTP API. Throws a generic error: never includes the key or response body. */
export async function sendViaResend(
  apiKey: string,
  message: ResendMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend rejected the email (HTTP ${res.status}).`);
}
