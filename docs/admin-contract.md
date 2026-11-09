# Admin data contract

The single source of truth between the database (`supabase/migrations/0001_site_admin.sql`) and the admin UI (`admin/index.html`, `js/admin.js`). Change both together.

## Connection

`js/config.js` sets:

```js
window.EXPERIUS_BACKEND = { url: 'https://<ref>.supabase.co', anonKey: '<publishable or legacy anon key>' };
```

While `url` is empty the backend is not connected yet: the public site skips analytics and the form shows its failed alert; the admin shows a "Backend not connected" notice instead of the login form.

The admin uses supabase-js v2 (`js/vendor/supabase.min.js`, UMD, `window.supabase.createClient`).

## Auth

- Email + password: `sb.auth.signInWithPassword({ email, password })`. No sign-up, no magic link, no reset flow (reset happens in the Supabase dashboard; say so in a small hint under the form).
- After sign-in call `sb.rpc('is_admin')` → `true | false`. On `false`: show "This account doesn't have admin access", then `sb.auth.signOut()`.
- On successful admin sign-in set `localStorage.experius_admin = '1'` (the public analytics script then skips this browser). Keep it after sign-out on purpose.
- Any response with HTTP 401, or a PostgREST/RPC error with code `42501` / message `not_admin` or `JWT expired`, means the session is gone: return to the login screen with "Your session ended. Sign in again."

## Table `review_requests` (read + limited update)

Readable by admins via `sb.from('review_requests').select(...)`. Admins may update **only** `status` and `notes`.

| column | type | notes |
|---|---|---|
| `id` | uuid | |
| `created_at` | timestamptz | display in `Asia/Dhaka` |
| `updated_at` | timestamptz | set by trigger |
| `name` | text | untrusted |
| `email` | text | untrusted, lower-cased |
| `business` | text | untrusted |
| `business_type` | text | one of the form's options |
| `improve` | text[] | values: `website leads booking crm followup workflows content reporting unsure` |
| `context` | text | untrusted, 10–2000 chars, may contain newlines |
| `country` | text \| null | untrusted |
| `website` | text \| null | untrusted; only link it if it starts with `http://` or `https://`, else show as text |
| `contact_method` | text \| null | `Video call`, `Email`, `WhatsApp`, `Phone call` |
| `phone` | text \| null | untrusted |
| `source` | text \| null | "How did you hear about us" answer |
| `page_path` | text \| null | page the form was on |
| `utm` | jsonb \| null | keys among `source medium campaign term content` |
| `visitor_id` | uuid \| null | |
| `consented_at` | timestamptz | |
| `status` | text | `new contacted booked won closed spam` (default `new`) |
| `notes` | text \| null | ≤ 5000 chars, admin-only |
| `notified_at` | timestamptz \| null | when the Telegram alert went out |

Labels for `improve`: website → Website or digital presence · leads → Inquiries and lead management · booking → Booking or registration · crm → CRM and customer information · followup → Follow-up and communication · workflows → Internal workflows · content → Content strategy or production · reporting → Reporting and visibility · unsure → Not sure yet.

Update example: `sb.from('review_requests').update({ status, notes }).eq('id', id).select('id,status,notes,updated_at').single()`.

## RPCs (all require an admin session)

Each raises `not_admin` (code `42501`) for non-admins. `days` is clamped to 1–400. Days are calendar days in Asia/Dhaka, including today.

### `admin_analytics_summary(days int)` → jsonb

```json
{ "days": 30, "since": "2026-10-10T18:00:00+00:00",
  "visitors": 0, "sessions": 0, "pageviews": 0, "cta_clicks": 0,
  "form_starts": 0, "form_submits": 0,
  "requests": 0, "new_requests": 0,
  "start_to_submit_pct": null, "visitor_to_request_pct": null }
```

`requests` counts review_requests in range excluding `spam`; `new_requests` is all-time status `new`. Percentages are `null` when the denominator is 0 (show "—").

### `admin_analytics_daily(days int)` → rows `{ day: 'YYYY-MM-DD', visitors: int, pageviews: int }`

One row per day, oldest first, zero-filled.

### `admin_top(dim text, days int)` → rows `{ key: text, count: int }`, at most 10, highest first

`dim` ∈ `page` (paths) · `referrer` (hosts, `(direct)` for none) · `utm_source` · `device` (`mobile tablet desktop`) · `cta` (CTA labels) · `case` (case study names opened).

## Analytics events written by the public site (`js/analytics.js`)

`pageview`, `cta_click` (label = button text), `form_start`, `form_submit`, `selfcheck_tick` (label = item), `case_open` (label = client), `demo_play` (label = demo name). No form content is ever sent.

## Security rules for the UI

- Render every database value with `textContent` / DOM nodes. Never `innerHTML` with data.
- CSV export: quote every field (`"` doubled); prefix a cell starting with `=`, `+`, `-`, `@`, tab or CR with `'`.
- `mailto:` and `https://wa.me/<digits>` links are built from the values, URL-encoded.
