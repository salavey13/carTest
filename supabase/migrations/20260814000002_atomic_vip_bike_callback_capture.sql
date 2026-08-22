-- Atomic callback capture and notification claiming for rental.vip-bike.ru.
-- The service-role-only RPC closes two serverless races:
-- 1. rate-limit COUNT followed by INSERT;
-- 2. simultaneous retries sending the same Telegram notification.

create or replace function public.capture_vip_bike_callback_intent(
  p_intent_id uuid,
  p_bike_id text,
  p_phone text,
  p_source_route text,
  p_ip_hash text,
  p_metadata jsonb,
  p_notification_attempt_id uuid
)
returns table (
  result_status text,
  intent_id uuid,
  intent_metadata jsonb,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_existing_metadata jsonb;
  v_claimed_metadata jsonb;
  v_last_attempt timestamptz := '-infinity'::timestamptz;
  v_attempts integer := 0;
  v_global_count integer := 0;
  v_ip_count integer := 0;
begin
  if p_intent_id is null
     or p_phone is null
     or length(btrim(p_phone)) < 10
     or p_ip_hash is null
     or length(p_ip_hash) <> 64
     or p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object'
     or p_notification_attempt_id is null then
    raise exception 'invalid vip-bike callback capture payload'
      using errcode = '22023';
  end if;

  -- One short transaction-level lock serializes the duplicate check, quota
  -- check and insert. It is intentionally shared by all callback requests.
  perform pg_advisory_xact_lock(hashtextextended('vip-bike-callback-capture', 0));

  select fi.metadata
    into v_existing_metadata
    from public.franchize_intents fi
   where fi.id = p_intent_id
     and fi.slug = 'vip-bike'
     and fi.intent_type = 'callback_request';

  if found then
    if v_existing_metadata ->> 'notificationStatus' = 'sent' then
      return query select
        'duplicate_sent'::text,
        p_intent_id,
        v_existing_metadata,
        0;
      return;
    end if;

    begin
      v_last_attempt := coalesce(
        nullif(v_existing_metadata ->> 'notificationLastAttemptAt', '')::timestamptz,
        '-infinity'::timestamptz
      );
    exception when others then
      v_last_attempt := '-infinity'::timestamptz;
    end;

    if v_existing_metadata ->> 'notificationStatus' = 'pending'
       and v_last_attempt > v_now - interval '30 seconds' then
      return query select
        'pending'::text,
        p_intent_id,
        v_existing_metadata,
        greatest(1, ceil(extract(epoch from ((v_last_attempt + interval '30 seconds') - v_now)))::integer);
      return;
    end if;

    if coalesce(v_existing_metadata ->> 'notificationAttempts', '') ~ '^[0-9]+$' then
      v_attempts := (v_existing_metadata ->> 'notificationAttempts')::integer;
    end if;

    v_claimed_metadata := v_existing_metadata || jsonb_build_object(
      'notificationStatus', 'pending',
      'notificationAttempts', v_attempts + 1,
      'notificationLastAttemptAt', v_now,
      'notificationAttemptId', p_notification_attempt_id
    );

    update public.franchize_intents
       set metadata = v_claimed_metadata,
           last_seen_at = v_now
     where id = p_intent_id;

    return query select
      'retry_claimed'::text,
      p_intent_id,
      v_claimed_metadata,
      0;
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where fi.metadata ->> 'ipHash' = p_ip_hash)::integer
    into v_global_count, v_ip_count
    from public.franchize_intents fi
   where fi.slug = 'vip-bike'
     and fi.intent_type = 'callback_request'
     and fi.created_at >= v_now - interval '10 minutes';

  if v_ip_count >= 5 or v_global_count >= 30 then
    return query select
      'rate_limited'::text,
      p_intent_id,
      null::jsonb,
      600;
    return;
  end if;

  v_claimed_metadata := p_metadata || jsonb_build_object(
    'notificationStatus', 'pending',
    'notificationAttempts', 1,
    'notificationLastAttemptAt', v_now,
    'notificationAttemptId', p_notification_attempt_id
  );

  insert into public.franchize_intents (
    id,
    slug,
    bike_id,
    intent_type,
    stage,
    source_route,
    contact_channel,
    urgency_score,
    phone,
    last_seen_at,
    metadata
  ) values (
    p_intent_id,
    'vip-bike',
    nullif(btrim(p_bike_id), ''),
    'callback_request',
    'lead_captured',
    left(coalesce(p_source_route, '/franchize/vip-bike'), 1000),
    'web_callback',
    80,
    p_phone,
    v_now,
    v_claimed_metadata
  );

  return query select
    'created'::text,
    p_intent_id,
    v_claimed_metadata,
    0;
end;
$$;

create or replace function public.finalize_vip_bike_callback_notification(
  p_intent_id uuid,
  p_notification_attempt_id uuid,
  p_notification_status text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_updated integer := 0;
begin
  if p_notification_status not in ('sent', 'failed') then
    raise exception 'invalid callback notification status'
      using errcode = '22023';
  end if;

  update public.franchize_intents
     set metadata = metadata || jsonb_build_object(
       'notificationStatus', p_notification_status,
       'notificationLastAttemptAt', v_now,
       'notificationDeliveredAt', case
         when p_notification_status = 'sent' then to_jsonb(v_now)
         else metadata -> 'notificationDeliveredAt'
       end
     )
   where id = p_intent_id
     and slug = 'vip-bike'
     and intent_type = 'callback_request'
     and metadata ->> 'notificationAttemptId' = p_notification_attempt_id::text
     and metadata ->> 'notificationStatus' = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.capture_vip_bike_callback_intent(
  uuid, text, text, text, text, jsonb, uuid
) from public, anon, authenticated;
grant execute on function public.capture_vip_bike_callback_intent(
  uuid, text, text, text, text, jsonb, uuid
) to service_role;

revoke all on function public.finalize_vip_bike_callback_notification(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.finalize_vip_bike_callback_notification(
  uuid, uuid, text
) to service_role;

comment on function public.capture_vip_bike_callback_intent(
  uuid, text, text, text, text, jsonb, uuid
) is 'Service-role-only atomic callback capture, quota check and Telegram delivery claim for VIP BIKE Rental.';

comment on function public.finalize_vip_bike_callback_notification(
  uuid, uuid, text
) is 'Service-role-only compare-and-set finalization for a claimed VIP BIKE Rental Telegram notification.';
