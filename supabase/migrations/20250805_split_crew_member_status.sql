-- Отключаем триггеры на время миграции, чтобы избежать побочных эффектов
ALTER TABLE public.crew_members DISABLE TRIGGER ALL;

-- Переименовываем старую колонку status в membership_status
ALTER TABLE public.crew_members
RENAME COLUMN status TO membership_status;

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
ALTER TABLE public.crew_members ENABLE TRIGGER ALL;

-- Создаем индекс для новой колонки для быстрой фильтрации
CREATE INDEX IF NOT EXISTS idx_crew_members_live_status ON public.crew_members(live_status);