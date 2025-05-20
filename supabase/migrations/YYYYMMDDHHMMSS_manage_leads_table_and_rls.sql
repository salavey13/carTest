-- Удаляем таблицу leads, если она существует, для чистого создания (ОСТОРОЖНО НА ПРОДЕ!)
DROP TABLE IF EXISTS public.leads CASCADE;

-- Создаем таблицу leads (адаптирована под строковый user_id из существующей таблицы users)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'kwork', 
  lead_url TEXT UNIQUE,                
  client_name TEXT,                    
  project_description TEXT NOT NULL,   
  raw_html_description TEXT,           
  budget_range TEXT,                   
  posted_at TIMESTAMPTZ,               
  similarity_score NUMERIC(5,2),       
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'raw_data', 'analyzed', 'offer_generated', 'contacted', 'interested', 'demo_generated', 'in_progress', 'closed_won', 'closed_lost')),           
  -- user_id из public.users, который является Telegram ID в строковом формате
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
-- Предполагается, что таблица public.users уже существует и имеет колонки user_id (TEXT, PK), status (TEXT), role (TEXT)

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Политика для администраторов (полный доступ к лидам)
-- Замени (SELECT status FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'admin'
-- на твою реальную проверку админского статуса, если JWT claim 'chat_id' не используется или называется иначе.
CREATE POLICY "Admins can do anything with leads"
  ON public.leads FOR ALL
  USING ((SELECT status FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'admin')
  WITH CHECK ((SELECT status FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'admin');

-- Политика для Саппортов (могут управлять всеми лидами)
-- Замени (SELECT role FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'support'
-- на твою реальную проверку роли 'support'.
CREATE POLICY "Support can manage all leads"
  ON public.leads FOR ALL 
  USING ((SELECT role FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'support');
  -- WITH CHECK здесь можно опустить, так как USING уже достаточно ограничивает.
  -- Если нужны более тонкие проверки при INSERT/UPDATE для Саппорта, можно добавить.

-- Политика для Танков (могут видеть и обновлять назначенные им лиды)
CREATE POLICY "Tanks can view assigned leads"
  ON public.leads FOR SELECT
  USING (
    assigned_to_tank = (auth.jwt() ->> 'chat_id') 
    OR (SELECT role FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'support' -- Саппорты видят все
    OR (SELECT status FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'admin' -- Админы видят все
  );

CREATE POLICY "Tanks can update their assigned leads"
  ON public.leads FOR UPDATE
  USING (assigned_to_tank = (auth.jwt() ->> 'chat_id'))
  WITH CHECK (assigned_to_tank = (auth.jwt() ->> 'chat_id'));

-- Политика для Кэрри (могут видеть и обновлять назначенные им лиды)
CREATE POLICY "Carry can view assigned leads"
  ON public.leads FOR SELECT
  USING (
    assigned_to_carry = (auth.jwt() ->> 'chat_id')
    OR (SELECT role FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'support' -- Саппорты видят все
    OR (SELECT status FROM public.users WHERE user_id = (auth.jwt() ->> 'chat_id')) = 'admin' -- Админы видят все
  );

CREATE POLICY "Carry can update their assigned leads"
  ON public.leads FOR UPDATE
  USING (assigned_to_carry = (auth.jwt() ->> 'chat_id'))
  WITH CHECK (assigned_to_carry = (auth.jwt() ->> 'chat_id'));

-- Заметка: (auth.jwt() ->> 'chat_id') 
-- это ПРЕДПОЛОЖЕНИЕ, что твой JWT содержит claim 'chat_id' с Telegram ID.
-- АДАПТИРУЙ это под свою реальную структуру JWT или метод получения ID текущего пользователя из таблицы users.
-- Если ты используешь `request.user.id` в SQL функциях, убедись, что он соответствует строковому Telegram ID.