-- ═══════════════════════════════════════════════════════════════════════════
-- /supabase/migrations/20260626000000_message_templates.sql
-- Message Templates for CRM quick replies and automation
--
-- Supports variable substitution (e.g., {customer_name}, {bike}, {return_date})
-- Crew-specific templates override default templates
-- ═══════════════════════════════════════════════════════════════════════════

-- Message templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id         UUID REFERENCES crews(id) ON DELETE CASCADE,  -- NULL = default template
  template_key    TEXT NOT NULL,                                   -- e.g., "return_reminder", "deposit_return", "welcome"
  name            TEXT NOT NULL,                                   -- Human-readable name
  subject         TEXT,                                            -- Email subject (optional)
  body            TEXT NOT NULL,                                   -- Message body with {variables}
  channel         TEXT NOT NULL DEFAULT 'telegram',                -- 'telegram', 'email', 'sms'
  language        TEXT NOT NULL DEFAULT 'ru',                      -- For multi-language support
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One template per crew+key+channel+language
  UNIQUE(crew_id, template_key, channel, language)
);

-- Indexes
CREATE INDEX idx_message_templates_crew ON public.message_templates(crew_id) WHERE crew_id IS NOT NULL;
CREATE INDEX idx_message_templates_key ON public.message_templates(template_key);
CREATE INDEX idx_message_templates_active ON public.message_templates(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Crew members can view their templates
CREATE POLICY "Crew can view templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (
  crew_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = message_templates.crew_id
    AND cm.user_id = (auth.jwt() ->> 'chat_id')
  )
);

-- Crew owners can manage their templates
CREATE POLICY "Crew can insert templates"
ON public.message_templates FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = message_templates.crew_id
    AND cm.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);

CREATE POLICY "Crew can update templates"
ON public.message_templates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = message_templates.crew_id
    AND cm.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);

-- Comment
COMMENT ON TABLE public.message_templates IS 'Message templates for CRM communications with variable substitution';

-- Insert default templates (Russian)
INSERT INTO public.message_templates (crew_id, template_key, name, body, channel) VALUES
-- Return reminder (24 hours before)
(NULL, 'return_reminder_24h', 'Напоминание о возврате (24ч)',
'👋 Здравствуйте, {customer_name}!

Напоминаем, что прокат мотоцикла {bike} заканчивается завтра в {return_time}.

📍 Место возврата: {return_location}
📱 Если остались вопросы — пишите!

Надеемся, вам понравилась поездка! 🏍️', 'telegram'),

-- Return reminder (same day)
(NULL, 'return_reminder_same_day', 'Напоминание о возврате (в день)',
'👋 {customer_name}, привет!

Сегодня последний день проката {bike}.
⏰ Время возврата: {return_time}

Пожалуйста, верните технику вовремя, чтобы следующие клиенты не ждали.
📍 {return_location}

Спасибо! 🙏', 'telegram'),

-- Deposit return notification
(NULL, 'deposit_return', 'Возврат депозита',
'✅ Здравствуйте, {customer_name}!

Ваш депозит в размере {deposit_amount} ₽ возвращен на карту {payment_method}.

Спасибо, что выбрали нас! Ждем вас снова 🏍️', 'telegram'),

-- Welcome message
(NULL, 'rental_welcome', 'Приветственное сообщение',
'🏍️ Добро пожаловать, {customer_name}!

Ваш прокат {bike} начинается с {start_date}.
📍 Место выдачи: {pickup_location}
⏰ Время: {start_time}

Полный cost: {total_price} ₽
Депозит: {deposit_amount} ₽

Желаем отличной поездки! 🌤️', 'telegram'),

-- Overdue notice
(NULL, 'rental_overdue', 'Просрочка возврата',
'⚠️ {customer_name}, здравствуйте!

Время проката {bike} истекло {return_time}.
Пожалуйста, свяжитесь с нами как можно скорее.

📞 {contact_phone}', 'telegram'),

-- Review request
(NULL, 'review_request', 'Запрос отзыва',
'⭐ {customer_name}, спасибо за выбор нашего сервиса!

Как прошла поездка на {bike}?
Оставьте отзыв, это поможет нам стать лучше:

{review_link}

Надеемся увидеть вас снова! 🏍️', 'telegram')
ON CONFLICT (crew_id, template_key, channel, language) DO NOTHING;

-- Function to render template with variables
CREATE OR REPLACE FUNCTION render_template(
  p_template_id UUID,
  p_variables JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT AS $$
DECLARE
  v_template TEXT;
  v_result TEXT;
  var_key TEXT;
BEGIN
  SELECT body INTO v_template
  FROM public.message_templates
  WHERE id = p_template_id AND is_active = true;

  IF v_template IS NULL THEN
    RETURN NULL;
  END IF;

  v_result := v_template;

  -- Replace variables in order: longest keys first to avoid partial replacements
  FOR var_key IN
    SELECT key FROM jsonb_object_keys(p_variables) ORDER BY length(key) DESC
  LOOP
    v_result := regexp_replace(
      v_result,
      '{' || var_key || '}',
      COALESCE(p_variables->>var_key, ''),
      'g'
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION render_template IS 'Render a message template with variable substitution';
