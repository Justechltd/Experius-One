-- Experius Website: Business Review requests, first-party analytics, admin access.
-- Applied with the Supabase MCP apply_migration using this exact SQL (it writes no file itself).
-- Never put rollback SQL in this folder: anything in migrations/ gets applied.
--
-- Access model
--   anon (the public site): may call submit_review_request(), may INSERT analytics_events. Nothing else.
--   authenticated: may call is_admin() and admin_* RPCs; every one checks is_admin() itself.
--                  May SELECT review_requests and UPDATE (status, notes) only when is_admin().
--   admins table: no policies, so it is reachable only through SECURITY DEFINER functions.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------- review_requests
create table public.review_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  name           text not null check (char_length(name) between 1 and 100),
  email          text not null check (char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  business       text not null check (char_length(business) between 1 and 120),
  business_type  text not null check (char_length(business_type) between 1 and 120),
  improve        text[] not null check (cardinality(improve) between 1 and 9),
  context        text not null check (char_length(context) between 10 and 2000),
  country        text check (char_length(country) <= 80),
  website        text check (char_length(website) <= 200),
  contact_method text check (contact_method in ('Video call', 'Email', 'WhatsApp', 'Phone call')),
  phone          text check (char_length(phone) <= 30),
  source         text check (char_length(source) <= 60),
  page_path      text check (char_length(page_path) <= 200),
  utm            jsonb check (utm is null or pg_column_size(utm) <= 1000),
  visitor_id     uuid,
  consented_at   timestamptz not null,
  status         text not null default 'new' check (status in ('new', 'contacted', 'booked', 'won', 'closed', 'spam')),
  notes          text check (char_length(notes) <= 5000),
  notified_at    timestamptz
);
create index review_requests_created_idx on public.review_requests (created_at desc);
create index review_requests_email_idx on public.review_requests (lower(email), created_at desc);

alter table public.review_requests enable row level security;
revoke all on public.review_requests from anon, authenticated;
grant select on public.review_requests to authenticated;
grant update (status, notes) on public.review_requests to authenticated;

create policy review_requests_admin_select on public.review_requests
  for select to authenticated using (public.is_admin());
create policy review_requests_admin_update on public.review_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end $$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

create trigger review_requests_touch before update on public.review_requests
  for each row execute function public.touch_updated_at();

-- The only way in for the public form. Same rules as js/review-form.js, checked again here.
-- Bots (honeypot filled, or sent in under 3 seconds) get {ok:true} and nothing is stored.
create or replace function public.submit_review_request(payload jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_name     text := nullif(btrim(payload->>'name'), '');
  v_email    text := lower(nullif(btrim(payload->>'email'), ''));
  v_business text := nullif(btrim(payload->>'business'), '');
  v_type     text := nullif(btrim(payload->>'businessType'), '');
  v_context  text := nullif(btrim(payload->>'context'), '');
  v_country  text := nullif(btrim(payload->>'country'), '');
  v_website  text := nullif(btrim(payload->>'website'), '');
  v_contact  text := nullif(btrim(payload->>'contactMethod'), '');
  v_phone    text := nullif(btrim(payload->>'phone'), '');
  v_source   text := nullif(btrim(payload->>'source'), '');
  v_path     text := left(nullif(btrim(payload->>'page_path'), ''), 200);
  v_vid      text := payload->>'visitor_id';
  v_improve  text[];
  v_utm      jsonb;
  v_elapsed  numeric;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  -- Bot traps: say yes, keep nothing.
  if coalesce(btrim(payload->>'company_url'), '') <> '' then return jsonb_build_object('ok', true); end if;
  begin v_elapsed := (payload->>'elapsed_ms')::numeric; exception when others then v_elapsed := null; end;
  if v_elapsed is null or v_elapsed < 3000 then return jsonb_build_object('ok', true); end if;

  if (payload->>'consent') is distinct from 'true' then raise exception 'invalid_consent' using errcode = '22023'; end if;
  if v_name is null or char_length(v_name) > 100 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if v_business is null or char_length(v_business) > 120 then raise exception 'invalid_business' using errcode = '22023'; end if;
  if v_type is null or char_length(v_type) > 120 then raise exception 'invalid_business_type' using errcode = '22023'; end if;
  if v_context is null or char_length(v_context) < 10 or char_length(v_context) > 2000 then
    raise exception 'invalid_context' using errcode = '22023';
  end if;
  if char_length(v_country) > 80 or char_length(v_website) > 200 or char_length(v_source) > 60 then
    raise exception 'invalid_optional_field' using errcode = '22023';
  end if;
  if v_contact is not null and v_contact not in ('Video call', 'Email', 'WhatsApp', 'Phone call') then
    raise exception 'invalid_contact_method' using errcode = '22023';
  end if;
  if v_phone is not null and (char_length(v_phone) > 30 or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7) then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;

  if jsonb_typeof(payload->'improve') <> 'array' then raise exception 'invalid_improve' using errcode = '22023'; end if;
  select array_agg(distinct v) into v_improve
    from jsonb_array_elements_text(payload->'improve') as t(v)
   where v in ('website', 'leads', 'booking', 'crm', 'followup', 'workflows', 'content', 'reporting', 'unsure');
  if v_improve is null then raise exception 'invalid_improve' using errcode = '22023'; end if;

  -- Only the five standard UTM keys, each trimmed to 100 characters.
  if jsonb_typeof(payload->'utm') = 'object' then
    select jsonb_object_agg(k, left(payload->'utm'->>k, 100)) into v_utm
      from unnest(array['source', 'medium', 'campaign', 'term', 'content']) as k
     where coalesce(payload->'utm'->>k, '') <> '';
  end if;

  if v_vid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_vid := null; end if;

  -- Flood guards: 3 per email per hour, 20 site-wide per 10 minutes.
  if (select count(*) from public.review_requests
       where lower(email) = v_email and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if (select count(*) from public.review_requests where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.review_requests
    (name, email, business, business_type, improve, context, country, website, contact_method, phone,
     source, page_path, utm, visitor_id, consented_at)
  values
    (v_name, v_email, v_business, v_type, v_improve, v_context, v_country, v_website, v_contact, v_phone,
     v_source, v_path, v_utm, v_vid::uuid, now());

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.submit_review_request(jsonb) from public, authenticated;
grant execute on function public.submit_review_request(jsonb) to anon;

-- ---------------------------------------------------------------- Telegram alert hook
-- After each insert, pg_net calls the notify-review-request Edge Function. Two Vault secrets drive it:
--   project_url         https://<ref>.supabase.co
--   notify_hook_secret  random hex; the function checks it via hook_secret_ok()
-- A failure here never blocks the insert.
create or replace function public.notify_review_request()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_hook_secret';
  if v_url is null or v_secret is null then return new; end if;
  perform net.http_post(
    url := v_url || '/functions/v1/notify-review-request',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'notify_review_request failed: %', sqlerrm;
  return new;
end $$;
revoke all on function public.notify_review_request() from public, anon, authenticated;

create trigger review_requests_notify after insert on public.review_requests
  for each row execute function public.notify_review_request();

-- The Edge Function (service role) asks this whether the header it received is genuine.
create or replace function public.hook_secret_ok(candidate text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'notify_hook_secret' and decrypted_secret = candidate);
$$;
revoke all on function public.hook_secret_ok(text) from public, anon, authenticated;
grant execute on function public.hook_secret_ok(text) to service_role;

-- ---------------------------------------------------------------- analytics_events
create table public.analytics_events (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  visitor_id    uuid not null,
  session_id    uuid not null,
  event         text not null check (event in ('pageview', 'cta_click', 'form_start', 'form_submit', 'selfcheck_tick', 'case_open', 'demo_play')),
  path          text not null check (char_length(path) between 1 and 200),
  referrer_host text check (char_length(referrer_host) <= 100),
  utm_source    text check (char_length(utm_source) <= 100),
  utm_medium    text check (char_length(utm_medium) <= 100),
  utm_campaign  text check (char_length(utm_campaign) <= 100),
  device        text check (device in ('mobile', 'tablet', 'desktop')),
  label         text check (char_length(label) <= 80)
);
create index analytics_events_created_idx on public.analytics_events (created_at);
create index analytics_events_event_created_idx on public.analytics_events (event, created_at);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;
grant insert on public.analytics_events to anon;

-- Insert-only for the public site; created_at must be "now", so nobody can backfill fake history.
create policy analytics_events_anon_insert on public.analytics_events
  for insert to anon
  with check (created_at between now() - interval '1 minute' and now() + interval '1 minute');

-- ---------------------------------------------------------------- admin read RPCs (Asia/Dhaka days)
create or replace function public.admin_analytics_summary(days int default 30)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_days  int := greatest(1, least(coalesce(days, 30), 400));
  v_since timestamptz := (date_trunc('day', now() at time zone 'Asia/Dhaka') - make_interval(days => v_days - 1)) at time zone 'Asia/Dhaka';
  r jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select jsonb_build_object(
    'days',         v_days,
    'since',        v_since,
    'visitors',     count(distinct visitor_id),
    'sessions',     count(distinct session_id),
    'pageviews',    count(*) filter (where event = 'pageview'),
    'cta_clicks',   count(*) filter (where event = 'cta_click'),
    'form_starts',  count(*) filter (where event = 'form_start'),
    'form_submits', count(*) filter (where event = 'form_submit'),
    'requests',     (select count(*) from public.review_requests where created_at >= v_since and status <> 'spam'),
    'new_requests', (select count(*) from public.review_requests where status = 'new')
  ) into r
  from public.analytics_events where created_at >= v_since;

  return r || jsonb_build_object(
    'start_to_submit_pct', case when (r->>'form_starts')::int > 0
      then round(100.0 * (r->>'form_submits')::int / (r->>'form_starts')::int, 1) end,
    'visitor_to_request_pct', case when (r->>'visitors')::int > 0
      then round(100.0 * (r->>'requests')::int / (r->>'visitors')::int, 1) end
  );
end $$;

create or replace function public.admin_analytics_daily(days int default 30)
returns table (day date, visitors bigint, pageviews bigint)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_days  int := greatest(1, least(coalesce(days, 30), 400));
  v_today date := (now() at time zone 'Asia/Dhaka')::date;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
    select d::date,
           count(distinct e.visitor_id),
           count(e.id) filter (where e.event = 'pageview')
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') as d
      left join public.analytics_events e
        on (e.created_at at time zone 'Asia/Dhaka')::date = d::date
     group by d
     order by d;
end $$;

-- dim: page | referrer | utm_source | device | cta | case
create or replace function public.admin_top(dim text, days int default 30)
returns table (key text, count bigint)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_days  int := greatest(1, least(coalesce(days, 30), 400));
  v_since timestamptz := (date_trunc('day', now() at time zone 'Asia/Dhaka') - make_interval(days => v_days - 1)) at time zone 'Asia/Dhaka';
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if dim not in ('page', 'referrer', 'utm_source', 'device', 'cta', 'case') then
    raise exception 'invalid_dim' using errcode = '22023';
  end if;
  return query
    select k, count(*)::bigint
      from (
        select case dim
                 when 'page'       then case when e.event = 'pageview' then e.path end
                 when 'referrer'   then case when e.event = 'pageview' then coalesce(e.referrer_host, '(direct)') end
                 when 'utm_source' then case when e.event = 'pageview' then e.utm_source end
                 when 'device'     then case when e.event = 'pageview' then e.device end
                 when 'cta'        then case when e.event = 'cta_click' then e.label end
                 when 'case'       then case when e.event = 'case_open' then e.label end
               end as k
          from public.analytics_events e
         where e.created_at >= v_since
      ) s
     where k is not null
     group by k
     order by 2 desc, 1
     limit 10;
end $$;

revoke all on function public.admin_analytics_summary(int) from public, anon;
revoke all on function public.admin_analytics_daily(int) from public, anon;
revoke all on function public.admin_top(text, int) from public, anon;
grant execute on function public.admin_analytics_summary(int) to authenticated;
grant execute on function public.admin_analytics_daily(int) to authenticated;
grant execute on function public.admin_top(text, int) to authenticated;

-- ---------------------------------------------------------------- retention
-- Raw analytics older than 13 months are deleted nightly (03:17 UTC).
select cron.schedule(
  'purge-old-analytics',
  '17 3 * * *',
  $$delete from public.analytics_events where created_at < now() - interval '13 months'$$
);

notify pgrst, 'reload schema';
