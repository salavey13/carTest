-- Удаляем таблицу leads, если она существует, для чистого создания (ОСТОРОЖНО НА ПРОДЕ!)
DROP TABLE IF EXISTS public.leads CASCADE;

-- Создаем таблицу leads
-- Предполагается, что таблица public.users УЖЕ СУЩЕСТВУЕТ и имеет:
-- user_id TEXT PRIMARY KEY (Telegram ID пользователя)
-- status TEXT (например, 'member', 'admin')
-- role TEXT (например, 'support', 'tank', 'carry', или NULL)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'kwork', 
  lead_url TEXT UNIQUE,                
  client_name TEXT,                    
  project_description TEXT NOT NULL,   
  raw_html_description TEXT,           
  budget_range TEXT,
  project_type_guess TEXT,
  posted_at TIMESTAMPTZ,               
  similarity_score NUMERIC(5,2),       
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'raw_data', 'analyzed', 'offer_generated', 'contacted', 'interested', 'demo_generated', 'in_progress', 'closed_won', 'closed_lost')),           
  assigned_to_tank TEXT REFERENCES public.users(user_id) ON DELETE SET NULL, 
  assigned_to_carry TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  assigned_to_support TEXT REFERENCES public.users(user_id) ON DELETE SET NULL,
  notes TEXT,                          
  supervibe_studio_links JSONB,        
  github_issue_links JSONB,            
  generated_offer TEXT,                
  identified_tweaks JSONB,             
  missing_features JSONB,              
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Индексы для таблицы leads
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_posted_at ON public.leads(posted_at DESC);
CREATE INDEX idx_leads_similarity_score ON public.leads(similarity_score DESC NULLS LAST);
CREATE INDEX idx_leads_assigned_to_tank ON public.leads(assigned_to_tank);
CREATE INDEX idx_leads_assigned_to_carry ON public.leads(assigned_to_carry);
CREATE INDEX idx_leads_assigned_to_support ON public.leads(assigned_to_support);

-- RLS Policies для таблицы leads --

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Вспомогательная функция для получения ID текущего пользователя из JWT (если claim называется 'chat_id')
-- Адаптируй 'chat_id', если твой claim называется иначе (например, 'sub' или 'user_id_tg_string')
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'chat_id');
EXCEPTION
  WHEN others THEN
    RETURN NULL; -- В случае ошибки или отсутствия claim возвращаем NULL
END;
$$ LANGUAGE plpgsql STABLE;

-- Вспомогательная функция для проверки статуса пользователя
CREATE OR REPLACE FUNCTION is_user_status(p_user_id TEXT, p_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id AND status = p_status);
END;
$$ LANGUAGE plpgsql STABLE;

-- Вспомогательная функция для проверки роли пользователя
CREATE OR REPLACE FUNCTION is_user_role(p_user_id TEXT, p_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.users WHERE user_id = p_user_id AND role = p_role);
END;
$$ LANGUAGE plpgsql STABLE;


-- Политика для администраторов (полный доступ к лидам)
CREATE POLICY "Admins can do anything with leads"
  ON public.leads FOR ALL
  USING (is_user_status(get_current_user_id(), 'admin'))
  WITH CHECK (is_user_status(get_current_user_id(), 'admin'));

-- Политика для Саппортов (могут управлять всеми лидами)
CREATE POLICY "Support can manage all leads"
  ON public.leads FOR ALL 
  USING (is_user_role(get_current_user_id(), 'support'));

-- Политика для Танков (могут видеть и обновлять назначенные им лиды, или все, если они также Саппорты/Админы)
CREATE POLICY "Tanks can view assigned leads"
  ON public.leads FOR SELECT
  USING (
    assigned_to_tank = get_current_user_id() 
    OR is_user_role(get_current_user_id(), 'support')
    OR is_user_status(get_current_user_id(), 'admin')
  );

CREATE POLICY "Tanks can update their assigned leads"
  ON public.leads FOR UPDATE
  USING (assigned_to_tank = get_current_user_id())
  WITH CHECK (assigned_to_tank = get_current_user_id());

-- Политика для Кэрри (могут видеть и обновлять назначенные им лиды, или все, если они также Саппорты/Админы)
CREATE POLICY "Carry can view assigned leads"
  ON public.leads FOR SELECT
  USING (
    assigned_to_carry = get_current_user_id()
    OR is_user_role(get_current_user_id(), 'support')
    OR is_user_status(get_current_user_id(), 'admin')
  );

CREATE POLICY "Carry can update their assigned leads"
  ON public.leads FOR UPDATE
  USING (assigned_to_carry = get_current_user_id())
  WITH CHECK (assigned_to_carry = get_current_user_id());

-- Политика, чтобы аутентифицированные пользователи (даже без спец. роли) могли, например, создавать лиды, если это нужно.
-- Пока закомментирована, так как Саппорт отвечает за создание.
-- CREATE POLICY "Authenticated users can insert leads if needed"
--   ON public.leads FOR INSERT
--   TO authenticated -- 'authenticated' - это специальная роль Supabase
--   WITH CHECK (true); -- Можно добавить доп. проверки, если нужно

-- ВАЖНО: Убедись, что имя JWT claim ('chat_id' в примере) для Telegram ID пользователя соответствует твоей конфигурации.
-- Если claim называется иначе, исправь это в функции get_current_user_id().
