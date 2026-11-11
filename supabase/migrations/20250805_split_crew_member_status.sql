-- Split member status into membership_status (invite lifecycle) + live_status (online/riding).
-- task177/178 chain-repair: made re-runnable and Supabase-pooler-safe.
--   * DISABLE/ENABLE TRIGGER ALL touches system RI triggers → permission denied for
--     pooled roles; only USER triggers are touched now (guarded).
--   * RENAME COLUMN fails on re-runs and on fresh chains where `status` was never born —
--     converted to a conditional rename.
DO $$ BEGIN
  ALTER TABLE public.crew_members DISABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN NULL; -- no user triggers yet / not owner
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crew_members' AND column_name = 'membership_status'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'crew_members' AND column_name = 'status'
    ) THEN
      ALTER TABLE public.crew_members RENAME COLUMN status TO membership_status;
    ELSE
      ALTER TABLE public.crew_members ADD COLUMN membership_status TEXT DEFAULT 'active';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'membership_status split skipped: %', SQLERRM;
END $$;

-- Добавляем новую колонку для живого статуса
ALTER TABLE public.crew_members
ADD COLUMN IF NOT EXISTS live_status TEXT NOT NULL DEFAULT 'offline';

-- Обновляем данные: если участник был 'active', его живой статус теперь 'offline'
UPDATE public.crew_members
SET live_status = 'offline'
WHERE membership_status = 'active';

-- Убедимся, что у всех ожидающих статус 'offline'
UPDATE public.crew_members
SET live_status = 'offline'
WHERE membership_status = 'pending';

-- Включаем триггеры обратно
DO $$ BEGIN
  ALTER TABLE public.crew_members ENABLE TRIGGER USER;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Создаем индекс для новой колонки для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_crew_members_live_status ON public.crew_members(live_status);
