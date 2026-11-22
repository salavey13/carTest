-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260908000000_lead_events.sql
-- Purpose:  Lead Game wave — persistent, crew-visible lead history.
-- PRD:      docs/PRD_LEADS_RNP.md §5 (history «как у мото в мотопарке»)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY: до этой миграции история лида выводилась ТОЛЬКО на клиенте из
-- производных данных (lead + todos + notes). Реальные события — создание
-- лида из Авито, «взял в работу», перезвоны, заметки, ответы AI — нигде
-- не хранились как факты: они исчезали вместе с производными строками и
-- не показывали, КТО из операторов что сделал. «Обслуживание лидов —
-- соревнование»: для прозрачного лидерборда и накопительной карточки
-- клиента («подготовка за 5 минут») события должны быть записанными.
--
-- Design:
--   * lead_id — тот же «ключ лида», что и в crew_todos.lead_id
--     (TG user_id / нормализованный телефон / "avito:<chat_id>"),
--     чтобы события матчились к лиду штатным путём страницы.
--   * actor — Telegram user_id оператора (или 'avito-agent' для
--     автоматических событий), резолвится в имя на клиенте по ростеру.
--   * points — сколько очков событие даёт оператору в лидерборде
--     (прогресс засчитывается не только за закрытия).
--   * Запись событий — best-effort: ни один маршрут не падает из-за
--     неудачи записи в журнал (история важнее, но не блокирует работу).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_events (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  crew_slug   text        NOT NULL,
  lead_id     text        NOT NULL,
  type        text        NOT NULL,
  actor       text,
  actor_name  text,
  label       text        NOT NULL,
  detail      text,
  points      integer     NOT NULL DEFAULT 0
);

-- Main read path: события лида на странице (crew + lead + время).
CREATE INDEX IF NOT EXISTS idx_lead_events_lead
  ON public.lead_events (crew_slug, lead_id, created_at DESC);

-- Leaderboard path: очки операторов за период (crew + actor + время).
CREATE INDEX IF NOT EXISTS idx_lead_events_actor
  ON public.lead_events (crew_slug, actor, created_at DESC);

COMMENT ON TABLE public.lead_events IS
'Persistent lead history (Lead Game wave): every recorded action on a lead —
ingest from Avito, operator handling, callbacks, notes, todos, closures —
with actor attribution and leaderboard points. lead_id matches
crew_todos.lead_id keys (TG id / phone / "avito:<chat_id>").';

-- RLS: журнал читают только участники экипажа (owner или active member).
-- Пишет приложение через service-role (bypasses RLS), клиент — только чтение.
-- NOTE: аутентификация в этом приложении — Telegram JWT c chat_id claim
-- (см. существующие политики crews/crew_members), НЕ auth.uid().
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_events crew read" ON public.lead_events;
CREATE POLICY "lead_events crew read" ON public.lead_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.crews c
      LEFT JOIN public.crew_members m
        ON m.crew_id = c.id AND m.membership_status = 'active'
      WHERE c.slug = lead_events.crew_slug
        AND (
          c.owner_id = auth.jwt() ->> 'chat_id'
          OR m.user_id = auth.jwt() ->> 'chat_id'
        )
    )
  );
