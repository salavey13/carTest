-- ═══════════════════════════════════════════════════════════════════════════
-- 20261011_avito_agent_try_create_rental.sql
--
-- ОПЦИОНАЛЬНО: атомарное бронирование для Avito-агента (ревью 89-a, п. 3.5).
-- Исполняет ВЛАДЕЛЕЦ руками (по нашей конвенции SQL-миграции не запускает ассистент).
--
-- Что даёт: check + insert в одной транзакции под advisory lock по vehicle_id —
-- два параллельных вызова BookMoto физически не смогут занять одно окно дважды.
-- Логика окна = канонические правила приложения (app/franchize/lib/rental-overlap.ts):
--   • блокирующие статусы: pending, pending_confirmation, confirmed, active
--   • окно строки: requested_* приоритет, agreed_* фолбэк, нет конца → старт+24ч
--   • льгота на возврат: +30 минут
--   • протухшие строки (конец+30мин в прошлом) не блокируют
--   • валидация: end>start, старт не в прошлом (±2ч), ≤30 суток, type='bike'
--
-- После установки C# может переключиться на атомарный вызов:
--   POST /rest/v1/rpc/try_create_avito_rental
--   { "p_chat_id": "...", "p_vehicle_id": "kawasaki-ex650k",
--     "p_start": "2026-10-12T09:00:00+00:00", "p_end": "2026-10-12T18:00:00+00:00" }
-- Ответ: { ok, rental_id, reason } — reason: bad_window|window_in_past|too_long|
--         not_a_bike|already_booked|other_crew
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.try_create_avito_rental(
  p_chat_id   text,
  p_vehicle_id text,
  p_start     timestamptz,
  p_end       timestamptz,
  p_delivery  text default null
)
returns table (ok boolean, rental_id uuid, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_car      record;
  v_user_id  text;
  v_new_id   uuid;
  v_conflict int;
  v_eff_end  timestamptz;
begin
  -- ── валидация окна ──
  if p_end <= p_start then
    return query select false, null::uuid, 'bad_window'; return;
  end if;
  if p_start < now() - interval '2 hours' then
    return query select false, null::uuid, 'window_in_past'; return;
  end if;
  if p_end - p_start > interval '30 days' then
    return query select false, null::uuid, 'too_long'; return;
  end if;

  -- ── машина существует и это байк ──
  select id, owner_id, crew_id, type into v_car
    from cars where id = p_vehicle_id;
  if not found then
    return query select false, null::uuid, 'car_not_found'; return;
  end if;
  if v_car.type is distinct from 'bike' then
    return query select false, null::uuid, 'not_a_bike'; return;
  end if;

  -- ── атомарная секция: lock по строковому ключу vehicle_id ──
  perform pg_advisory_xact_lock(hashtextextended('rentals:' || p_vehicle_id, 0));

  select count(*) into v_conflict
    from rentals r
   where r.vehicle_id = p_vehicle_id
     and r.status in ('pending', 'pending_confirmation', 'confirmed', 'active')
     -- эффективное окно строки: requested_* приоритет, agreed_* фолбэк, нет конца → старт+24ч
     and coalesce(r.requested_start_date, r.agreed_start_date) < p_end
     and coalesce(r.requested_end_date, r.agreed_end_date,
                  coalesce(r.requested_start_date, r.agreed_start_date) + interval '24 hours')
         + interval '30 minutes'   -- льгота на возврат
         > greatest(p_start, now())  -- протухшие (конец+30мин в прошлом) не блокируют;
  -- (условие выше: effective_end > window_start И effective_end > now)
  if v_conflict > 0 then
    return query select false, null::uuid, 'already_booked'; return;
  end if;

  -- ── клиент ──
  v_user_id := 'avito_' || p_chat_id;
  insert into users (user_id, language_code)
  values (v_user_id, 'ru')
  on conflict (user_id) do nothing;

  -- ── бронь ──
  v_new_id := gen_random_uuid();
  insert into rentals (
    rental_id, user_id, vehicle_id, owner_id, crew_id,
    status, payment_status, interest_amount,
    requested_start_date, requested_end_date,
    delivery_address, created_by_operator_chat_id, metadata
  ) values (
    v_new_id, v_user_id, v_car.id, v_car.owner_id, v_car.crew_id,
    'pending_confirmation', 'interest_paid', 0,
    p_start, p_end,
    p_delivery, p_chat_id,
    jsonb_build_object('source', 'avito-agent', 'avito_chat_id', p_chat_id,
                       'atomic', 'try_create_avito_rental')
  );

  return query select true, v_new_id, null::text;
end;
$$;

-- Права: service_role имеет доступ ко всему; explicit grant для PostgREST-вызова:
grant execute on function public.try_create_avito_rental(text, text, timestamptz, timestamptz, text) to service_role, anon, authenticated;

comment on function public.try_create_avito_rental is
'Avito-agent atomic booking (Task 89-a): advisory-lock по vehicle_id, правила окна как в rental-overlap.ts';
