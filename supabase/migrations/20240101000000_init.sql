-- Drop existing tables and functions to ensure a clean slate
DROP TABLE IF EXISTS user_results;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS cars CASCADE;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS search_cars CASCADE;
DROP FUNCTION IF EXISTS similar_cars CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create users table
CREATE TABLE public.users (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    website TEXT,
    language_code TEXT,
    subscription_id TEXT,
    status TEXT DEFAULT 'free',
    role TEXT DEFAULT 'attendee',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    active_organizer_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    badges JSONB,
    test_progress JSONB,
    CONSTRAINT check_status CHECK (status = ANY (ARRAY['free'::text, 'pro'::text, 'admin'::text]))
);

-- Create questions table
CREATE TABLE public.questions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    theme TEXT NOT NULL,
    position INT NOT NULL
);

-- Create answers table (REMOVED direct car links, branching instead)
CREATE TABLE public.answers (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES public.questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    next_question INT -- Defines which question to jump to next (NULL = next in order)
);

-- Create cars table (test results)
CREATE TABLE public.cars (
    id TEXT PRIMARY KEY,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT NOT NULL,
    embedding VECTOR(384),
    daily_price NUMERIC NOT NULL,
    image_url TEXT NOT NULL,
    rent_link TEXT NOT NULL,
    is_test_result BOOLEAN DEFAULT FALSE,
    specs JSONB DEFAULT '{}'
);
ALTER TABLE cars ADD COLUMN owner_id TEXT;
-- Create user_results table
CREATE TABLE public.user_results (
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    car_id TEXT REFERENCES public.cars(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX ON cars USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON users USING gin (username gin_trgm_ops);

-- Enable Row-Level Security on cars and add a public read policy
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON cars FOR SELECT USING (true);

Paul:
-- Enable Row-Level Security (RLS) for all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_results ENABLE ROW LEVEL SECURITY;

-- Users Table Policies
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
USING (auth.jwt() ->> 'chat_id' = user_id);

CREATE POLICY "Users can update their own data"
ON users
FOR UPDATE
USING (auth.jwt() ->> 'chat_id' = user_id);

-- Questions Table Policies
CREATE POLICY "Public can read questions"
ON questions
FOR SELECT
USING (true);

-- Answers Table Policies
CREATE POLICY "Public can read answers"
ON answers
FOR SELECT
USING (true);

-- Cars Table Policies
CREATE POLICY "Public can read cars"
ON cars
FOR SELECT
USING (true);

-- User Results Table Policies
CREATE POLICY "Users can read their own results"
ON user_results
FOR SELECT
USING (auth.jwt() ->> 'chat_id' = user_id);

CREATE POLICY "Users can insert their own results"
ON user_results
FOR INSERT
WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);






create table public.invoices (
  id text not null,
  type text,
  user_id text not null,
  subscription_id text not null,
  status text null default 'pending'::text,
  amount integer not null,
  currency text null default 'XTR'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  metadata jsonb null default '{}'::jsonb,
  constraint invoices_pkey primary key (id),
  constraint invoices_user_id_fkey foreign KEY (user_id) references users (user_id) on delete CASCADE,
  constraint check_status check (
    (
      status = any (
        array['pending'::text, 'paid'::text, 'failed'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists invoices_user_id_idx on public.invoices using btree (user_id) TABLESPACE pg_default;

create index IF not exists invoices_status_idx on public.invoices using btree (status) TABLESPACE pg_default;

-- Add trigger for updated_at
-- CREATE TRIGGER set_updated_at
--     BEFORE UPDATE ON public.invoices
--     FOR EACH ROW
--     EXECUTE FUNCTION public.set_updated_at();



-- Enable RLS on the invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own invoices
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT
-- Enable RLS on the invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own invoices
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'chat_id' = user_id); -- Assumes chat_id is passed as uid in JWT

-- Allow authenticated users to insert their own invoices
CREATE POLICY "Users can create own invoices" ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

-- Allow authenticated users to update their own invoices (if needed)
CREATE POLICY "Users can update own invoices" ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'chat_id' = user_id);

-- Admins can bypass RLS (handled via supabaseAdmin in code)



-- Create function to create invoice
CREATE OR REPLACE FUNCTION create_invoice(
    p_type TEXT,
    p_id TEXT,
    p_user_id TEXT,
    p_amount NUMERIC,
    p_subscription_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.invoices AS $$
DECLARE
    v_invoice public.invoices;
BEGIN
    INSERT INTO public.invoices (type, id, user_id, amount, metadata, subscription_id)
    VALUES (p_type, p_id, p_user_id, p_amount, p_metadata, p_subscription_id)
    RETURNING * INTO v_invoice;
    
    RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status(
    p_invoice_id TEXT,
    p_status TEXT
) RETURNS public.invoices AS $$
DECLARE
    v_invoice public.invoices;
BEGIN
    UPDATE public.invoices
    SET status = p_status,
        updated_at = now()
    WHERE id = p_invoice_id
    RETURNING * INTO v_invoice;
    
    RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user invoices
CREATE OR REPLACE FUNCTION get_user_invoices(
    p_user_id TEXT
) RETURNS SETOF public.invoices AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.invoices
    WHERE user_id = p_user_id
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;  TO authenticated
  USING (auth.jwt() ->> 'chat_id' = user_id); -- Assumes chat_id is passed as uid in JWT

-- Allow authenticated users to insert their own invoices
CREATE POLICY "Users can create own invoices" ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

-- Allow authenticated users to update their own invoices (if needed)
CREATE POLICY "Users can update own invoices" ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'chat_id' = user_id);

-- Admins can bypass RLS (handled via supabaseAdmin in code)



-- Create function to create invoice
CREATE OR REPLACE FUNCTION create_invoice(
    p_type TEXT,
    p_id TEXT,
    p_user_id TEXT,
    p_amount NUMERIC,
    p_subscription_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.invoices AS $$
DECLARE
    v_invoice public.invoices;
BEGIN
    INSERT INTO public.invoices (type, id, user_id, amount, metadata, subscription_id)
    VALUES (p_type, p_id, p_user_id, p_amount, p_metadata, p_subscription_id)
    RETURNING * INTO v_invoice;
    
    RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- Create function to update invoice status
CREATE OR REPLACE FUNCTION update_invoice_status(
    p_invoice_id TEXT,
    p_status TEXT
) RETURNS public.invoices AS $$
DECLARE
    v_invoice public.invoices;
BEGIN
    UPDATE public.invoices
    SET status = p_status,
        updated_at = now()
    WHERE id = p_invoice_id
    RETURNING * INTO v_invoice;
    
    RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user invoices
CREATE OR REPLACE FUNCTION get_user_invoices(
    p_user_id TEXT
) RETURNS SETOF public.invoices AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.invoices
    WHERE user_id = p_user_id
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;



DROP FUNCTION search_cars(vector,integer);

CREATE OR REPLACE FUNCTION search_cars(query_embedding VECTOR(384), match_count INT)
RETURNS TABLE (
    id TEXT, 
    make TEXT, 
    model TEXT, 
    description TEXT, 
    image_url TEXT, 
    rent_link TEXT, 
    owner TEXT, -- Changed to return username
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.make,
        c.model,
        c.description,
        c.image_url,
        c.rent_link,
        COALESCE(u.username, c.owner_id) AS owner, -- Fallback to owner_id if username is null
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM cars c
    LEFT JOIN users u ON c.owner_id = u.user_id
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Create function for similar cars (unchanged for now)
CREATE OR REPLACE FUNCTION similar_cars(
    car_id TEXT,
    match_count INT DEFAULT 3
) 
RETURNS SETOF cars
LANGUAGE plpgsql
AS $$
DECLARE
    target_embedding VECTOR(384);
BEGIN
    SELECT embedding INTO target_embedding 
    FROM cars WHERE id = car_id;
  
    RETURN QUERY
    SELECT *
    FROM cars
    WHERE id != car_id
    ORDER BY embedding <=> target_embedding
    LIMIT match_count;
END;
$$;








CREATE TABLE public.rentals (
    rental_id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    car_id TEXT REFERENCES public.cars(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active',
    payment_status TEXT DEFAULT 'pending',
    total_cost NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_dates CHECK (end_date > start_date),
    CONSTRAINT check_status CHECK (status IN ('active', 'completed', 'cancelled')),
    CONSTRAINT check_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed'))
);


ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rentals" ON public.rentals
FOR SELECT
USING (auth.jwt() ->> 'chat_id' = user_id);

CREATE POLICY "Users can create own rentals" ON public.rentals
FOR INSERT
WITH CHECK (auth.jwt() ->> 'chat_id' = user_id);

CREATE POLICY "Users can update own rentals" ON public.rentals
FOR UPDATE
USING (auth.jwt() ->> 'chat_id' = user_id);

CREATE INDEX ON public.rentals (user_id);
CREATE INDEX ON public.rentals (car_id);




CREATE OR REPLACE FUNCTION get_top_fleets()
RETURNS TABLE (
  owner_id TEXT,
  owner_name TEXT,
  total_revenue NUMERIC,
  car_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.owner_id,
    COALESCE(u.username, 'DEMO') AS owner_name,
    SUM(r.total_cost) AS total_revenue,
    COUNT(DISTINCT c.id) AS car_count
  FROM cars c
  LEFT JOIN rentals r ON c.id = r.car_id AND r.payment_status = 'paid'
  LEFT JOIN users u ON c.owner_id = u.user_id
  GROUP BY c.owner_id, u.username
  ORDER BY total_revenue DESC NULLS LAST
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-------------------------------------------------------
-- SEED QUESTIONS & ANSWERS (BRANCHING LOGIC)
-------------------------------------------------------

-- Question 1: **Как ты стартуешь день?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(1, 'Как ты стартуешь день?', 'morning', 1);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(1, 'Бодро! Газ в пол!', 2),  -- Next question: Громкая музыка?
(1, 'Спокойно... Ещё 5 мин сна', 3);  -- Next question: Электро или бензин?

-- Question 2: **Громкая музыка?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(2, 'Громкая музыка?', 'music', 2);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(2, 'Да! Бас в окно!', 4),  -- Next: Тёмный салон или яркий?
(2, 'Нет, тишина и концентрация', 5);  -- Next: Автопилот или контроль?

-- Question 3: **Электро или бензин?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(3, 'Электро или бензин?', 'engine', 3);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(3, 'Только электро!', 6),  -- Next: Космический экран или аналоговые кнопки?
(3, 'Бензин! Запах и звук!', 4);  -- Next: Тёмный салон или яркий?

-- Question 4: **Тёмный салон или яркий?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(4, 'Тёмный салон или яркий?', 'interior', 4);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(4, 'Черный как ночь!', 7),  -- Next: Технологии или механика?
(4, 'Яркий, как неон!', 8);  -- Next: Гибрид или V12?

-- Question 5: **Автопилот или контроль?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(5, 'Автопилот или контроль?', 'driving', 5);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(5, 'Автопилот, расслабляюсь', 6),  -- Next: Космический экран или аналоговые кнопки?
(5, 'Полный контроль, только я и машина!', 8);  -- Next: Гибрид или V12?

-- Question 6: **Космический экран или аналоговые кнопки?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(6, 'Космический экран или аналоговые кнопки?', 'dashboard', 6);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(6, 'Космический экран, всё на дисплее!', 9),  -- Next: Итог - авто по ИИ?
(6, 'Аналоговые кнопки, люблю тактильность!', 10);  -- Next: Итог - авто с механикой?

-- Question 7: **Технологии или механика?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(7, 'Технологии или механика?', 'tech_vs_mech', 7);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(7, 'Технологии, всё автоматизировано!', 9),  -- Next: Итог - авто по ИИ?
(7, 'Механика, чувствовать машину!', 10);  -- Next: Итог - авто с механикой?

-- Question 8: **Гибрид или V12?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(8, 'Гибрид или V12?', 'engine_choice', 8);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(8, 'Гибрид, мощь и экономия!', 9),  -- Next: Итог - авто по ИИ?
(8, 'V12, только эмоции!', 10);  -- Next: Итог - авто с механикой?

-------------------------------------------------------
-- FINAL RESULT: AI CARS OR MECHANICAL MONSTERS
-------------------------------------------------------

-- Question 9: **Итог - авто по ИИ?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(9, 'Тебе подходит авто с искусственным интеллектом!', 'ai_final', 9);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(9, 'ДА! Самоедет и анализирует!', NULL),  -- END TEST
(9, 'НЕТ! Мне нужна свобода!', 10);  -- Last question before test ends

-- Question 10: **Итог - авто с механикой?**
INSERT INTO public.questions (id, text, theme, position) VALUES
(10, 'Ты любишь машины с механическим характером!', 'mech_final', 10);

INSERT INTO public.answers (question_id, text, next_question) VALUES
(10, 'ДА! Чувствовать каждую деталь!', NULL),  -- END TEST
(10, 'ПОЧТИ... может что-то среднее?', 9);  -- Loop back to AI choice




