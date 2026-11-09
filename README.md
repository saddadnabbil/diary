# Diary.

A quiet diary with gentle writing prompts.

- Write with bold, italics, numbered and bulleted lists, and images (paste, drop or upload).
- Highlight passages in an entry, in three colours, and add notes to them.
- Calendar view: pick any past day and write on it.
- Writing prompts from a built-in library, or from an AI model you choose (DeepSeek by default, or any OpenAI-compatible API).
- Local-first: entries live on your device and sync to the cloud only when you turn sync on. In local-only mode, entries never leave the device (AI prompt suggestions still call the server with just the mood and time of day).

Built with Next.js 16 on Cloudflare Workers (OpenNext), D1 for data, R2 for images, Better Auth for email-code sign-in, Resend for the sign-in emails, Dexie (IndexedDB) on the device, and Tiptap for the editor.

## Quick start

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars      # set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:migrate:local               # creates the local D1 database
pnpm dev                            # http://localhost:3000
```

In development no email is sent. The sign-in code is printed in the terminal. To send real email while developing, set `RESEND_API_KEY` and `SEND_REAL_EMAIL=true` in `.dev.vars`.

To run the production build locally (Workers runtime, simulated D1 and R2):

```bash
echo "APP_URL=http://localhost:8787" >> .dev.vars
pnpm preview                        # http://localhost:8787
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with local Cloudflare bindings |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm typecheck` / `pnpm lint` | Type check and lint |
| `pnpm preview` | Build for Workers and run locally |
| `pnpm deploy` | Build and deploy to Cloudflare |
| `pnpm cf-typegen` | Regenerate `cloudflare-env.d.ts` after editing `wrangler.jsonc` |
| `pnpm db:migrate:local` / `pnpm db:migrate:remote` | Apply D1 migrations |

## Deploy to Cloudflare

1. **Account.** Set `account_id` in `wrangler.jsonc`, or export `CLOUDFLARE_ACCOUNT_ID`.
2. **Database.** `pnpm exec wrangler d1 create diary`, paste the printed `database_id` into `wrangler.jsonc`, then `pnpm db:migrate:remote`.
3. **Image bucket.** `pnpm exec wrangler r2 bucket create diary-images`.
4. **Email.** In [Resend](https://resend.com), verify a sending domain. Set `EMAIL_FROM` in `wrangler.jsonc` to an address on that domain.
5. **Secrets.**
   ```bash
   pnpm exec wrangler secret put BETTER_AUTH_SECRET   # random, 32+ characters
   pnpm exec wrangler secret put RESEND_API_KEY
   pnpm exec wrangler secret put DEEPSEEK_API_KEY     # optional, for the built-in AI model
   ```
6. **Origin.** Set `APP_URL` in `wrangler.jsonc` to your final `https://` address. The app refuses to start in production with a non-https `APP_URL`.
7. `pnpm deploy`
8. **Recommended.** Add a Cloudflare WAF rate-limit rule for `/api/*`. The app also rate-limits per user and per IP inside D1, but a WAF rule stops floods earlier.

## Security model

- **Sign-in:** 6-digit email code, stored hashed, valid for 10 minutes, locked after 3 wrong guesses. No passwords. Sessions are `HttpOnly`, `Secure` and `SameSite=Lax` cookies.
- **Rate limits** (shared across all Workers, stored in D1): code requests per IP and per mailbox, code checks per IP, and per-user limits on sync, AI calls, provider tests and account deletion. Plus-tags and Gmail dots count as one mailbox.
- **CSRF:** state-changing requests must come from the app's own origin.
- **Authorization:** every query is scoped to the signed-in user. Entry and image ids are namespaced per user.
- **Images:** the file type is decided from the bytes, not from the upload headers. Only PNG, JPEG, WebP and GIF are accepted (never SVG). Files are capped at 6 MB, and each account at 2,000 images or 500 MB. Images are served only to their owner, with `nosniff` and a sandboxed CSP.
- **Input limits:** request bodies are size-capped while streaming, entries are capped at 200 KB, and accounts at 20,000 entries.
- **Headers:** Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP/CORP. API responses are `no-store`.
- **SSRF:** a user-supplied AI base URL must be a public https host.
- **Privacy:** the AI route receives the mood and time of day. Titles of your three latest entries are sent only if you turn that option on. Entry text is never sent to the AI model.
- **Account deletion** removes the account, entries, images, sessions and counters.

### Known limits

- The Content-Security-Policy allows inline scripts, because the pages are static and cannot use per-request nonces.
- Data on the device is not encrypted. Anyone with access to an unlocked browser profile can read it, including saved AI API keys.
- Entries are readable by the server. There is no end-to-end encryption; that is what makes sync and AI prompts possible.
- Rate limits and the mail cap depend on the D1 database. Add a WAF rule for production traffic.

To report a vulnerability, please open a private security advisory on the repository instead of a public issue.

## License

[MIT](LICENSE)
