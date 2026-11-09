# Backend: Experius Website (Supabase)

| | |
|---|---|
| Project | "Experius Website", free tier, region `ap-south-1` (Mumbai), org "majedulhoque1's Org" |
| Project ref | `wbazifkgvimwgzaoqhxl` · https://wbazifkgvimwgzaoqhxl.supabase.co (created 2026-11-09) |
| Schema | `supabase/migrations/0001_site_admin.sql` (applied with the identical SQL through the Supabase MCP) |
| Edge Function | `supabase/functions/notify-review-request/index.ts`, deployed with `verify_jwt = false` (it checks its own header secret) |
| Data contract for the admin | `docs/admin-contract.md` |
| Public config | `js/config.js` (URL and publishable/anon key only; both are public by design) |

## Where secrets live (never in this repo, never pasted in chat)

| Secret | Where |
|---|---|
| Admin password | Supabase Auth only. Reset it in the dashboard (Authentication → Users) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, optional `SITE_URL` | Edge Functions → Secrets |
| `project_url`, `notify_hook_secret` | Supabase Vault (created by SQL: `select vault.create_secret(...)`) |
| Service role key | Only inside the Edge Function runtime (provided by the platform) |

## One-time dashboard steps (Majedul)

1. Authentication → Users → **Add user**: your email and a strong password (auto-confirm).
2. Authentication → Providers → Email → turn **"Allow new users to sign up" off**.
3. Telegram: message @BotFather → `/newbot` → copy the token. Send your new bot any message. Then add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (and `SITE_URL`) under Edge Functions → Secrets.
4. Tell Claude when 1–3 are done. Claude then adds your user id to `admins`, creates the two Vault secrets, and runs the test plan.

## How it fits together

- The form calls `POST /rest/v1/rpc/submit_review_request`. It validates, drops bots (honeypot, under 3 seconds), rate-limits (3 per email per hour, 20 site-wide per 10 minutes) and inserts. The site can never read a request back.
- An after-insert trigger calls the Edge Function through `pg_net`; the function checks the header secret against Vault, loads the row with the service role, sends Telegram (HTML-escaped) and stamps `notified_at`. A Telegram failure never loses the request.
- `js/analytics.js` inserts into `analytics_events` (insert-only for anon). The admin reads aggregates through `admin_*` RPCs, which refuse anyone not in `admins`.
- `pg_cron` deletes analytics events older than 13 months every night.

## Launch checklist

- [ ] Unpause the project in the dashboard if it is paused (free projects pause after about 7 days without activity) and check it is healthy.
- [ ] Add a weekly keep-alive ping once the site is deployed (e.g. a GitHub Actions cron that calls a cheap REST endpoint with the anon key).
- [ ] Confirm sign-ups are still off.
- [ ] Legal review of the privacy notice (analytics, retention period for requests, Telegram notification).
- [ ] Delete test rows (`business = 'TEST — delete me'`) and test analytics events.
- [ ] Set `SITE_URL` to the real domain so the Telegram link opens the admin.
- [ ] Run `get_advisors` (security) once more. Known open WARN: `pg_net` sits in `public` (moving it was declined 2026-11-09; low risk).
