// notify-review-request: sends one Telegram message per new Business Review request.
// Called only by the review_requests after-insert trigger (pg_net), never by browsers.
// Deployed with verify_jwt = false; it authenticates the caller itself via the x-hook-secret header,
// which is checked against Supabase Vault through the hook_secret_ok() RPC.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   required
//   SITE_URL                               optional, e.g. https://experius.xyz (link to the admin)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/+$/, "");

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const secret = req.headers.get("x-hook-secret") ?? "";
  const check = await db("rpc/hook_secret_ok", { method: "POST", body: JSON.stringify({ candidate: secret }) });
  if (!check.ok || (await check.json()) !== true) return json(401, { error: "unauthorized" });

  let id = "";
  try { id = String((await req.json()).id ?? ""); } catch { /* falls through to the check below */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: "bad_id" });

  const res = await db(
    `review_requests?id=eq.${id}&select=id,name,email,business,business_type,improve,context,contact_method,phone,notified_at`,
  );
  const rows = res.ok ? await res.json() : [];
  const r = rows[0];
  if (!r) return json(404, { error: "not_found" });
  if (r.notified_at) return json(200, { ok: true, skipped: "already_notified" });

  if (!BOT_TOKEN || !CHAT_ID) {
    console.error("Telegram secrets missing: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID");
    return json(500, { error: "telegram_not_configured" });
  }

  const context = String(r.context ?? "");
  const lines = [
    "<b>New Business Review request</b>",
    "",
    `<b>${esc(r.name)}</b> · ${esc(r.business)}`,
    esc(r.business_type),
    `Areas: ${esc((r.improve ?? []).join(", "))}`,
    "",
    esc(context.length > 300 ? context.slice(0, 300) + "…" : context),
    "",
    `Reply by: ${esc(r.contact_method || "no preference")}${r.phone ? " · " + esc(r.phone) : ""}`,
    `Email: ${esc(r.email)}`,
  ];
  if (SITE_URL) lines.push("", `<a href="${esc(SITE_URL)}/admin/#requests">Open in admin</a>`);

  const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!tg.ok) {
    console.error("Telegram send failed", tg.status, await tg.text());
    return json(502, { error: "telegram_failed" });
  }

  await db(`review_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ notified_at: new Date().toISOString() }),
  });
  return json(200, { ok: true });
});
