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





-------------------------------------------------------
-- CARS
-------------------------------------------------------

-- Insert Rental Cars (cars for rent)
INSERT INTO public.cars (id, make, model, description, daily_price, image_url, rent_link, specs) VALUES
(
  'lamborghini-huracan',
  'Lamborghini',
  'Huracan EVO',
  'Адреналиновый взрыв! V10 640 л.с., рёв двигателя разбудит весь район. Для тех, кто начинает день с полного газа и хочет быть в центре внимания.',
  1500,
  'data:image/jpeg;base64,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',
  '/rent/lamborghini-huracan',
  '{
    "version": "v12",
    "electric": false,
    "color": "Yellow",
    "theme": "classic",
    "horsepower": 640,
    "torque": "600Nm",
    "acceleration": "2.8s 0-60mph",
    "topSpeed": "205mph"
  }'::jsonb
),
(
  'mclaren-720s',
  'McLaren',
  '720S',
  'Британская точность и мощность 720 л.с. Аэродинамический дизайн и умная электроника. Для ценителей технологий и контролируемой агрессии.',
  1700,
  'data:image/jpeg;base64,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',
  '/rent/mclaren-720s',
  '{
    "version": "V8",
    "electric": false,
    "color": "Silver",
    "theme": "modern",
    "horsepower": 720,
    "torque": "800Nm",
    "acceleration": "2.9s 0-60mph",
    "topSpeed": "212mph"
  }'::jsonb
),
(
  'tesla-s-plaid',
  'Tesla',
  'Model S Plaid',
  'Электрическая революция! 0-100 км/ч за 1.9 сек, автопилот и минималистичный салон с гигантским экраном. Для тех, кто доверяет ИИ и любит космические технологии.',
  2000,
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxIQDw0PEBAPDw8PDQ0NDQ8PEA8QDw0NFREWFhURFRUYHSggGBolGxUVITIhJSkrLi4uFx8zOjMsNygtLisBCgoKDg0OFRAQFy0dHR0tLS8rLS0tLS0tLS0tKy0rKy0tLS0tLS0tLS0tLS0tKysrKy0rLS0tLS0tLS0tLSstK//AABEIAKgBLAMBEQACEQEDEQH/xAAcAAADAAMBAQEAAAAAAAAAAAAAAQIDBAYFBwj/xABAEAABAwICBgcFBgUDBQAAAAABAAIDERIEEwUhMUFRYQYUInGBkaEyQpKx0RVSU2LB8CNDcoKiB1ThMzREk8L/xAAaAQEBAQEBAQEAAAAAAAAAAAAAAQIDBAUG/8QAMBEBAAICAAQDBQgDAQAAAAAAAAERAgMEEiExE0FRBSJhcdEUMkJSgZGh8BWx4cH/2gAMAwEAAhEDEQA/AOmDF9C3jUI0DsQO1A7UDDUU7FAixEorUBaqHRQoUQFqAtQMMVBYgVqAtQFqFC1LBagdqAtQFqAtQFqAtQFqB2oC1ArUBagLUBagLUCtQFqKKIhhqiqAQOxAZalgsVBagYCgdEBQIEWqhWogtQO1AWoGGorIoJLQgksVsK1EFqWotSw7UsFqWgtSwWpai1LBYlgtSw7UsFqAtQK1LBagLUKFqBWqAtVBagm1A7UFAIGFA0DogLUFBqlgLFbCtQFqAogLUDtUDLFbAGoKy1LUZSWUgsS0FqoLUBalgtQO1AWqAtQFqtqLUBaloLVFFEQWoULUUrUBagLUCtVsFqWJtRDtQMNUsO1LDtQFqB0RVUUDogLUKFEKK1ChahQtVDooHRAAIKCgCEE2q2C1LBRAUQFqWGGoGAoGWopUQK1VBYihrUFWqBFqCCFQWogsSwrUsKiWC1A7UDtQFqB2oC1A7UBagdqhQogdEBagLUBagKIHRAUQFEDoiiiAogdEBagA1FBaoFaqgoighEFEBRRTDUDogKIJLEspNqqUCECLUCogq1LKO1ChahR2oC1LKMMUtaOxLKOxLKFiWUVqWC1LQWpai1LQ7UtRalh2pYLUsO1LBagLUBagLUBapYLUsFFVFEQUQK1AUQFqAogKICiBEIoogKICiAtUBalh2pYLUsO1LFBqli2juUVVqCrUsKxLCy0soGIJZSDGFbSitSwWpYdqWHalgtSwWqWHalgtVtaFqWUVqWULUCollC1LShRLKKiWUKJZQolgolgolgtVsFqllC1LKKxLKK1LKFqWBBksWbWjy0so8tLKGWllCxWygGqB2oUdqFHai0VqILUKFqLQsSyjsSyjsSyhYllHYllC1LKFqWNTEaRgj9ueFnJ0jAfKq1GOU9oS4aEvSjBN24qLwJd8gteHn6JzQwO6ZYD/AHLfhk+ieFn6HNAb0xwB/wDJZ4tf9E8LP0XmhtRdIsI/2cTF4kj5rM4ZR3hrHGc/uxM/o2otIQv9ieFx4NkYT5VU6tzqzx74zH6Nm1S3MWoFaqC1AWpYdqBWoC1AWqIRagVFQUQFqDNRYaNAIGgKIGGpYLUsO1LWhREoUQFEsOiAtSw7UsFqB2otPF0t0lw+HqLsx491mzxds+a6Y65yZmacni+l+Mm/7eNsbT75AOrvdq8l2jXhHfqz70/Bz2mH4tzHyYjGGxoLiKvIHIDZyW4yiO0UnK5DDOlneA1pcCd7gKcSTyUnb5WsYeb1/sFzsPJPGDNlPY2ZjHOvja72XivtNqKcdY1LnlsyiatuMca7PDc+IVBdI14JFtDW77ttNqzz5NRjE9IZcJhzqLqknW1nAcXLlO6cprH9308eE18NjGe+Lyntj9XsYTDukBDbnSC4hjdQLWtLjSmutAdXJWIiIuXn2cXtzmrqPSOkf35tR0hpqJHCjiCtRHVw8TOO0y9TRun8RBQxzPaPuk3M8QdqtE7Jn73X5/Xu7PQ3+oDTRuLZbuzowS3vc3aPBScWJiJ7O2w07JWNkjc17HCrXNIIIWZ6M1TLapaC1AUQFqAtSwUSwrUCtQFEBRBmtWLU7UsoWpYdqWtC1ChRCjtQoUQOiB2oHagYYgRIG8eYV6h6uI806jBisTYOy3MduaHMaPEk6h3VVjGS3GdIBpHEAtYcPEw+4JqV7yAar0YRhj5W5TcvGwfRiZhvkMc0n5pnWNPJtuvx9FrLOZ8liKbGLw8zB2urN/qxNvzYsNRjM9ocX0sE0wZGx2HsBLnhmIY8udu2bhr8+Sk507Rwu2fwtDRDnYdr6xsc9zbAc2jWjjsOvYufPF3LtHA75jpj/MKw+Mnjd2LNY7VJXBjuTuzUjkplvwh21+yeJzmqiPnP0a2JhymvxEhEspLy0D2WucS40G5tSdZ4rzTsnblXaH1fs2r2bq8XL3s57el/T1nu8/DaUq03Po8uqaAkgUFNxXXKaiIwh8vRlr255bOJz6z/AD/x7OgOlDsNPHIwhxBI7cDiKHUfZAWJyzmKmHpmPZ8z1ymPlf0ltaTMTnXQhzWFrXFrqdl52gfl2UqKr0YzNRb5WyMYymMZuPVm0bba64NJBoKgHaumXdyjsqRrCHUtBGylAp1ab3RnSk+GnaYictx/jxurlvHED73MK06a9WWc+ker61o7GNnYHtqD7zTtafouWUU5Z48s026LLIoiiiWgolgollCiFFagVqWULUKZVi2qCthhSw0sKiWCo4qhhClUSyjoljBjcWyFhe80AFdw1cSdw5q44zlNQOVl6VzzktwkTWx7DiJQbf7Wnb3nyXojTEd2oiI7pDt+IxEkzt7brYx4BbjH0hznK+0G/T0cYo21vdtV8O+6Vk039JS82sJceDdZWvDiF5JebjelUcbrHS3SnZDB/GlrwNptaeRNVic8YdMdGUxfaPi05dPYt1bMJLC3c7ECwkcQZbGD1WeeG41a475f39La4+0JnRtETJHS/wDSa7SGCGbt9mNkoDth3bljLbX4f3d8I0R3y/aPq8zSnXMM/Lliiw7jX/ptwjz4lpcV59m/ZhETNRb6vCaOG4iZjHmyrvfb/bVj0hiXODQ97ydgaAK+QXOOLnze2fZuqO2L0BDMey91r/u5rS7yqt/aMcnOOEjGaipa2IiLTR7mjXTtFo18Nazlnl5Tb044acYvOsfn0D9GFza6qHYQQAfJcNmUzEw9WvDXMROM3Hza2G0M1hcaMFdtAKkrGvPZEVMs/Y9ETcYR1+Dbbo8fdr3Nr+i6c8pPDafyx+0B+AI9mEu8Lf0XTHP1l5t2rHH7mrHL9Yj/AMlmbow/hn4UjZPq14On8sfsyjRrtzXDwAWvElnwtPpDGcLM12okDVUlxB8gkbsvWXPLhscsorDGY+N3+z0MFpCaN3Zmlbr3PctY7cp7yzt4HRX3Id10c0tJJRspurqDqAGvOi6zEVb4HF8Pjrm8XR0WHioUQoUQoURaFEShRFoWoCxB5/XOXqtcqWOucvVOUsdc5JyljrR7u5XlhLIz121PilAEw4ILE44JRZ544JRa2zJS24zp1jX3BsQw8lKXtnnMbQQagWhpu169ZGwcFrHbGDpr055dYcU/pFi8yNkwgihIkBfhyZSy2NzgLSRttp4rUcR8nbLh88IucbeTNpXHOr2WU3Vlo6nMCor4qfavk9McJs/J/LUdiMU72g0dz7lmeJy9XbDhZ/Fj/JMx8jQ9r2iSoADHukbENesuawgv3Uq6m2oO7lO/KfvdnXPg5mPcmp+X9pH2rirbGytjZr7ELMlhrxbGWg7d4qpG7GI6Q80+zNuU+9n/ALZ9GYaGt85muBBbkQYSp4kyP1g15FX7VHo3/hts1WcfzH1dJgOkHVrjhIXCdzbHYzFy9ZxNm9rOy1rB4GtBWtFyz4iZ7Q9en2JHTxM7+EfX/jTy5JXF7y573nW5xq5x/e5eXKZym8n6DTq16sIxxiohsyVufg4HFhbRuNxDNUjpCK9Xjd7oA9p27lrXTXhHeX572l7QyyznXrmohgf0Uwsgc1uXfvPaBu45nHwXe5fFqGDQzSMQdG40Zwc0nCySCr3BnaMTzvI2g/UKTEd4fU4Ti5zjwdvvR5X/AK+jtxDFHS7LZspUAHavLnlUvsYZ55x7sLOJg/EZ4VXPna5Nv5UOxkH4g8nfRa8Rnw9v5UHHQfiD4X/RXxGfB2+iPtGCp7e4e6/nyV52fA2+i2Y+AmmYBXi1wHmQrzszp2x1pWMw1ASdQAJJ4Ab1ea117HLl8hP8OIyyUDywuLGRMOsBxAJuIINKahStKrthE93PjePx1e5EXPm7DoBpVuIzGFhinw7m50TnB1oOxzXe80028ivTGXR8LiNsbIt2j8STs1fNWIeG0xykcT6qzESMnWTy9VOUshM7iB5JUFsrZ+OtSltlzm8fQqVJZCZv7CVJcMgIUVzl/wC9a7U5jM5+hSgxIOPoUFZv7oUoLM/dD9EoMSJQsP8A3rUFB6Kbzc1zbrSWuAdr7NRtRHzLpDg6PcesMcampLXAk8TtXLLh8p6vrcPu6RFOZlZT+ZGfF30XGdOUPpYbY9GA/wBTPM/RY8LJ3jbCbubfNTw5b8SElw32+JCsY5Qc2Mirfyq+8twtsjRw9VPeXnxjzehg5GEgDWeAUmJ83TDbEzWOUT+r1nYxuGjkxDm1yo3vjafelp2AeVSFznrMR6rxG2cNOeUT2hq6Ma2PBfxHkSShznu2uc5xucdo2uPovV5vyF31l5+GxrpLmA0q0F54RjaTwWjvHRu9JjSDBYxhIfhsTE27eQHC2vgXV7gszHeG9OVbMJ+MNzHY10kjnnVcWmm4DUvBn1l+44bCMMOWPJgdMeK509NMZlPNaSkgk7Kk8lWZ6MrMDM7ZHJ3kEDzK1UuM7cI84bEei5qito75GfVWcZc/H1/2Je7iZXDDxxS9hoc3MkJFDh29oivGgomFx3eDKMOfLPHr07fH+9XO4jSdggJdR8pM84Dhde8XU46qgBe/CK6Py+zOcpnKfN6+i8ZlaQwOKLCOtMxOCmaKVNGiSN7q76AevFa7TSYRzRL6JmU1VXWnnUHlKFh5QMP7koO/uUDqePoqEWk+8UAGn73z+qWPIDlUIy81RQk/YUDzTw9VQsw8D5hA8xBYcgYd+9Sgx48F0E7WglxglDQ3bWw0VjuPzbJpXFUq6Wb++pFPFcuafV358sfgwfasu99e9rfopLpHE7I8zGlZPynwUpuOM2QtulXb2tPmFOV0jj847xD0dH4psm6jttK7RxC5Zxli+jwnE47riqlv9XaTrrTgDqCxGyY7O+fDYbPvTP7s7cKwa6HzTx9nqz/jeGiL5f5ls6PcGyOc2vZYG69YDnGvyA81NmyZxhrguEww2ZTjHkx9J8SeqPuJN08MfIbX+HsLnoi9jt7XyjDheWPxTH1/8epJhhJh4TRziGOoG8nn9CF64fmJYxNmOZVoiDMK9laBolOsAeutJxdNedX8mfSgc7Rga5tC/GwxsHEUoT/kFMui8PjzbMY9ZhmhjjJJkkLNY1BhcSF4Mn7fGcouovq2M7CN/FeedrQs01OW2fOISdLYdvswt/uAcfUlbj5MTjM980O0+fdFo4NIHyC1Ez6MeHr85tgOkZHk0Dj8RWuaUrXAMkoBcWOAG02voPFObJLwmahn0rpBztGYm95pHHPYwfec1rB6v/xUwmZzxt4OPjHVr2ZYx1mO5RSAxNdVtk8UYeaAuEYs7Q7jrHcvfEdH5eO9vU0HAZHYB1KhmKxMwcdd0bIgy7xLwE75Q1hNY5/J3PWP3cPqutvPyrGJ5DzCWcrI3EfsUQ5T6wOSHKRxQ5IUYxY/ZP0UKPrf71/RCi67yCFOSEr/AMU/CF1plYxD/wAV3wM+qVBahO/8R3/rZ9UqC19af+I74G/VTlhbIYs/ed8LE5S1jHHi7yaE5IXmPr54OPiPonJCc4+0D90+Y+ickHPLDiphKx0cjC5jqXC4itDUaxQ7lYxiEnKZc5jejOHfWjpoyeEgIHmK+qs4xPcjOY83G9KtDHCgPjxEcjfejeQ2Wv5QSbguWeEQ3GyXLHFcWNP9rfoubfN8Ib2isH1lxYxsDSBX+K9sd3IClSfBWMb7HPEfheq3o1PGQRHHUbCyVnyJCuWrKYddPEa9eUZcvX5rODxLdsdO7LPyK5Toy9H0MfaWCXMm2Fkv9rBrWfCy9G/8hrnvMtzC6Vjw4LJY5Bdro4EVP3qlcs9Wc+T26faPC4x0mY/R5vSbSTJMPHGwg3T51a7A1hbT/Ipo15Y5TMvL7W43Vvwxx1zfV0fQvSGbA6CozaExA07T6ULNe80aR3LtPSXx46w9HC6BlkLY7H1LAHVBAa6u0lWZSGp0rxzGuwsEbrocJrLxQ5s21zhyqBT+nms8vNEu+jdGnZGcxdPFk6QDc2ve0H9Vj7P8X1I9t1FcjLgtNSPJADYxStxw8b6+YKscNj55MZe2sp7a223Sc+6V4H5MKwfJiv2fD1c59rbJ/B/tnZpB59qfGj+mGi1HD6/Vzn2pt/LDOzEMPtYjSXwu+ivg4erH+T3flj9v+qxMUTmHLxOJbJ7pnhdIznUBoPqnhYep/kt/lUfo43TbsXWWAh0sZLe3FG8MkaCHDVTiBqPBSNeMTbnt47fswnDKek/B0PQ/E1ibFPHMx0Ysact2uOtQKHuWp6PLHV9I0PE1sQIBibY2OGKvaZE2pq78znOc494W8fizLaDvzH0W7SlB35j6JZSw7mUKBfzKWUkyc0soxL3pZQMg5pZSS8JZTSub+XyVtKFzeA8kuShVvAeqXJUCjeA9UuSoFreA8ynNJUHlt4epV5pTlgslvA+ZTmk5YPIbwPmnPJysWIwrS00uHik5ysYw8PF6HD9rneaxOctckPHxfQ2KQ1LnVWJyleSGo7/T+I/zXjyTm+C8pM/0/Y1wcMRICNY1NTm+ByN93RZ/+7f8I+qviSeGxO6JO34p/wAP/KnPK8jE7oe7din/AAf8qc8nIkdDpP8AdHxir/8ASc8ryNbGdBHSUJxDARvbh6Ejn29anMk4L0f0Fkidc3FjdUGE6/8ANSepGNOpjwM7miOXGyvj2OZ2hcOBN1SO9ZpptT4KMgNDWgAUFAEpYYRomPgPVSm4xW3RUY90JTXLCho5n3R5JRywsYNo90K0VChhhwCtFQyNgCUdFHDjklJMwtsQC1TnLZYVqIYllbTj8ltlWriiCoQsiRxKCfH5KgpzUCPePVEKp4j1RXmCUqWKE3NLRQm5q2KE3MpYrO71LDE6WHnoFnq2JdMitd71lYlBci2Ya47AT3AlSi2QYWQ/y3/A5KW1jBSfdI7y1vzKUWRwx3uYO+Rn6FRbQYwPeYe4k/olFkKDeFKbiSe4KUsykPC1TmoSBKRRkClNRJiXuSnSJBlSjmTmIllmJRYzCrSWYkKUWrNSiZMSrTEyytmVZtkz1WbIzlAs88UQZ6oWegRxCCTiUEdY70Gu2GQ7I3/CQsDIMJL9yneWj5lLDyHDaY298jfqlgsG+WIdxJ+QSw6x75vhjeUUs2Ie/Ie5jR8yiH1qEbpT3uYP0RT69F+ET3yO/QBAjpJu6GLxvd8ygg6WO5kI7o2/qgX2zJudT+lrB8ggh2lZT/Nk+Ij5KKwvxjjtc497iUGPPVLPPRbAmQs85RqEOnRU56rJifvQPPUWDE/co1B5/NFHWERJxCqDrCBifmiH1kcVQdbCUzLI3FK0lrGKVpk+tJRaTiFUsusIJOJ5oqTiuCCDiOagM7mg0zjHna9573OKzSozeaFmJkFZyB5yIecgM5AZqBGZBBxCKk4hAusIDPQLP5oFnc0UxPzKChOixJGdRbTnc1UGbzRBnBFLrIUasji+9C0nGIWXWyqWOsnn5oljrHNCx1jmqWYxCrMsjcSjKxiVbQ+tBLKPrSllJOKS1T1k8QgRnKBZqWHmKWrUz1EPOQPOQGcgM5AZyAzkCM6CTOUEmZFTnIDOQGagM5FGegOsIEcRzQLPQGegM5AjKgWdzRSzggM5AZyIM1Aw9BQegrNRBnKgziiDNQPMQGYgYlQPNCgM9ULP5oNETKB56A6wgOsIDrCA6wgXWEUs/mgWciFnIoz0Qs9FGcgWagecgM4IDPRUmdBOciDOQGainmc0BmIDNQPNQGageagecgM9EPPQPORBnc0UZyBZyAzkCMyBGVEGag//2Q==',
  '/rent/tesla-s-plaid',
  '{
    "version": "Model S",
    "electric": true,
    "color": "Red",
    "theme": "futuristic",
    "horsepower": 1020,
    "torque": "1050Nm",
    "acceleration": "1.99s 0-60mph",
    "topSpeed": "200mph"
  }'::jsonb
),
(
  'porsche-911-gt3',
  'Porsche',
  '911 GT3',
  'Механическая чистота! 4.0L атмосферный двигатель, механическая КПП и аналоговые приборы. Для тех, кто хочет чувствовать каждую кочку и оборот двигателя.',
  1800,
  'data:image/jpeg;base64,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',
  '/rent/porsche-911-gt3',
  '{
    "version": "GT3",
    "electric": false,
    "color": "Racing Yellow",
    "theme": "track",
    "horsepower": 500,
    "torque": "420Nm",
    "acceleration": "3.2s 0-60mph",
    "topSpeed": "198mph"
  }'::jsonb
),
(
  'bmw-i8',
  'BMW',
  'i8 Roadster',
  'Гибрид будущего! 1.5L турбо + электромотор, двери-"крылья бабочки" и прозрачный капот. Для тех, кто ищет баланс между экологичностью и эмоциями.',
  1600,
  'data:image/jpeg;base64,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',
  '/rent/bmw-i8',
  '{
    "version": "Hybrid",
    "electric": true,
    "color": "Icy Blue",
    "theme": "futuristic",
    "horsepower": 369,
    "torque": "420Nm",
    "acceleration": "4.2s 0-60mph",
    "topSpeed": "155mph"
  }'::jsonb
),
(
  'ferrari-sf90',
  'Ferrari',
  'SF90 Stradale',
  'Гибридный монстр! 1000 л.с., полный привод и активная аэродинамика. Для тех, кто хочет все: технологии F1 и рёб V8 одновременно.',
  2500,
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxQTEhUTExMVFhUVFxcXGBgYGBcXFxcYFxcXFxgVGBgYHSggGBolHhUVITIhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGhAQGy0mICUtNS8uLS8tLS0vLS0tLS0tLy0tLi8tLS0tLS0tLS0tLS0tLS0tKy0tLS0tLy0tLS0tLf/AABEIAKEBOQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAAEBQECAwAGB//EAEgQAAEDAgMFBQUGAggFAwUAAAEAAhEDIQQSMQVBUWFxIjKBkaETQlKx8AYUcpLB0WLhIzNTgqKy0vEVc5PC4hZUsyQ0Q2OD/8QAGwEAAgMBAQEAAAAAAAAAAAAAAQIAAwQFBgf/xAA0EQACAQIDBAcIAgMBAAAAAAAAAQIDEQQhMQUSQVFhcYGRobHRBhMUIjLB4fBC8RUjM3L/2gAMAwEAAhEDEQA/APFYsBznkBhD3Zs3dLTJJGXdqdxHA70ZTrFtFk1AWS5haO1VDHRmGUmIABiRYuNxKWyrByT3z5HS+BXMLcWOptLQGuaYggAkAAAuF7mJJ4ofBY2pSINNzhOo3a6XkG2+FUuUZlPfMb4GL4jL7232EAXLw97YnMQ4kMj4RkZfhUdvCQ1mvc4uIMuJJ6kyUbmUZ0HWYfgYc2Afd38PkssXWh7uqZ50lxp/pHeHyCanNykUYrDxpU8ufqXGIK1p4xwQMri5XmBDqjtPitjj27yB4rzhqKXOlsgEumLSSRru0SsZMe18eALdo8NPPgkmK2pVcA4ODQSQA0XtGpPULDA06zHhzWvbcXymNd8iEc3CWIhnxDtdk3PZuZa4boP7lM2xshb7V5k5nmNTLrfsq1sU4gNd7swT3r6yTc6C2gjmZPwrXUyS0ATYgupVGnwcQq7Qoh5BDabYEQwtbO+Tc3v6IdgBX7U8deQ9OHgum2pRNbAEGzmOFryBuE68DI8FYYONDPHuekPKILFaQkSCQVcYlw1OYKrMMW7ifrlKq5scR1J/ZG4LM2fWBGqCqd5ayQZbIPJZG5vZRyGUQ6lqueqUqgCq6uFns7nW95FRs2XXKrXg6KwQYU0yVegbnw/VUCvQaZceEfqiiPVfvBmlQr3f2d2eXYam5pYTl7rgOJ42Xg3he7+z9ZwwtOA6Mu4tjfuJlCWhYr3+X90PC7UEV6si/tH6WE5iqGmHZnZXCe6GglouLSTMRm46DirbTdNaqeNR5/xFSx5GWCdAmirmOtPdMHd0DgXfJv7KoC1xx7bvxH9Fm0byY1FhOkc+ajQYyWRYNPBTKLpVDbSI6KtIgvMnUx4So4AhidctDBpVpVHOkk8SSrMqROlxF4PzVZtU7LMkajx/ykfqrZTwPksp0/bor+0dwf5FM4NrQrWIgpPP9sO5VgVnK2oUHO08zYDxQNVipKrmWrqIDcxeNSABcnw3BYBo3ucOjW/q8JXNFqoTtexJeqGot6eGBv23dMrfPveitFMWhg5kvefGDH+FDfQyosENVBYnCVHPs0gRMkcBrxiAvRU6DGhri7vOymBECJmwbE6AGDadLq32hqtytyQ2mW7hE9q877T1BngjGpZ5FeIwinB7+iu8uhHnG7MfmDXOAJ0EiT0bdx/KtTgS2wovdzeQz5Ez5BNMdVZTb/RANBk8DMkZidXSADJ3E3XkcTizPZc7rJA8BK2s8y7DoYarc5clrGmym52hsSS2BMaT+4TaddzZfVcIMEXkdRu3FTh8I/Jn9o4GJ1PXii9n4ovOWoZJETbtDnzHenhm5IxtfMjFvsQDJqvkXkWgi8zKltJryYFWod9y7UzJgcZUY+hlqEHd+4WVSuTqZjQE2HJo0CZ2T0AEfd6YN2j88+jSStm4On8E9M/6kIB9ctjtC4uG+7fQnQnfbiN+ne3J3opoAyGApfB/i/8ANc7BURbJH9537qmzagntTEiY1hH432QjI6JvDzA8C6BPJNePIFzFuFoxGQCxGYOfN9/eiR081q3Yzf7V3nI9WquDywZeA2RN2PjnF43p/seoxjC3KagzGDMGNxbFoOsQUVuciZnmq+xyNBmHFpBd+U5fSUur0I3yN8S0jkQRE9J6r3j69B1pcz8QzR4iDw3LHEUWOBGcEEAEtJa+AZGoGYAidCllRT+kiqNangnUuBn5rNzDwXpcZgTSjewmz22I5Hh00MWiSlhAa9pc1pE905ocNIlungbHyVDi1ky1SuK22RjnCZbOUzE6xO/msSxvH0RWSwDngRYC5t4BJJXRbRm4uxnm6+RReDrNaHSAZ4nLHmFjDPjcejf3IRWFxbWaNe7nA+WZIomqVVWWZFasHDstZ4Ok/Ne22DS/+lpkalg90H11C8k7H0jrmHVhPylbsxQDOw4DK3szTaNBYZnNv5oTi2siyjiYxd5eH5Yq2hTPtalj33/5iuNItYHcXEAQdGi7ukkAdHcEYK9GXEvHem0b2tJtprKMpU21C0D2gADW9zdae9Ekkud1ceSZJozyqRnqA4pzQaYe1vaa17jeW5jyN+zDvEKraeGiYrnkcgbM6SCYtHG6K26XgZ4gOJAEC05iGiDoAI03IHBvaxuYkgNmY96dAEyV9SmUlogmgzDOMeydJ4uJ+UI47IZpkI8XA/NKWbYqm1FrWNm1hJTDCbersMVIe3eBZw8NPAhXxlFcCi7Z1TYcQWyDqN9wdfMICpsrIJLnbzZrA0eLniPJeswW16bxmvE3iA4G2oOh6EI44WlUEsePr5eKZ7j6Bkmzw9ENaYPtQDEnI0gDjZ9x0R04f/3Dv+kf9S32v9mTd9MweLTbzGiRfcsTxqfn/wDJC8loK0NlpSBdDAf58uf80pY5xI7NpvJHyErI4yo6oRTbMHSJmNSTuWKUG3ZHoKWNpwjvyXGyPRVdnPbunmLoZa4LaVQb3CLFpvHn/JMninWv3H8Rp/eH6+pWWVPPpO5TqqUFJZp8UeMrYx85XgmDeSco/CGlseaIOHY6kew0VG3zNLzmHAhzjygiEx2tspw3XOhnsu/vHQ9YS3AVO1kNjwNjwNvFbqcoyWR5HG0KtGpabbXB8wnZNYuplutz6X+RKZV2Q32ZudTyJiW9bCeBtxlR9nuyXH4DPV2mXneJ5Smd5vM751nnzWOr8snY9Hs7/bhoqWlrfbyFe2sWDLQInTdAbu9IjklVGmHEDzXoMbgBUAMgX1t8tYS+js59MnQ7gRdbo1IyV7nl62Eq0puLi8uNg320MI46eSXU3ODgQ0yCCLHd+iNAaWBpBnMcwNhENy6GT7389xD6QHs3iASNYDu6cou6T3Q0KxmZJu75f0RtugHNbVGm/jEanmQZ8UgfSXqzihVc5haAXDQaZ2tBJjcXAk6+7bRefNGHZTusrHnmAXOYitn4YuMxyHUrWtQtKOwLoY1zbEHXgQZB+SRoBk3DETBNjpAE8SC5wtYX5hEPwxNNuYSCSARGogkWmCMw81rhnSSOLXc9xI+So0oXzI9ExZUbkOU79/EInCYssILXEeoVdrRkB35hHqq7Jp3lxAuAJ0HF5G8AXjfEI3InxPSM2nmLDWYx2UyWmQXggiDBBAvOu4IdlRoNgeU7h6z6JdjMrnyyQ2wuZc7i9x4ny4QLDWkOf19dFZGQrGtKtqDBBsQbgjml2LwppkPZdgII4sO6/wAnefOadU/Q/ZGUcT4jeD9QVY0pqzIshFjqFM025KZ9oDc5icw3dk2aenhwRWDwTCxpcASQCTJm9415+i1x2Fydtnd3je39xz3eqEZRFR/YcWvOoADp10EgEnhqYtdYq0JaaHRwFenTk5TipdD/AHUrj8B7MwCCCJ1BI6wfrwQ+Ux1hG1KLnauzGInf9XUt2c85RABsbuDbdXEJFJRXzMadKdWTlThlyWdu0BdSHwj0/VQabYsQOoP6SmFTBPFovyIPqLFYOwbvhPhf5I70eYJYWtFXcH3AuTp5hWGH/g8h+yu9irlTmZo6o7LcyQNWkm4NjY74JWLMOajqdMGSdRfUxBPn4Ig1HRYkIrYLs+LpsLiAQBmHZcHZLw7Udr0RQklYMxlPI1tOg5zC4WqGzH2uCWCWOE910ttM3lE7OpOcDQcfb1GszntB0EvZLWPm0MB0MZi4EO0WNMH2z6dJzntJzPJpsqMEkBk52dk5bl1uA0BJrHVQ9nsHMqdtgc4UoyQQ4l3s3EZTDdwJFrKTbSdtQRWeYmxNI4eqeBgHUAtd3Hcjx4GRfVafeSDIJB5Lf7SVy5zvaCmeyZdTeTYPdue2ZzZrTZLHOPwu/wAP6FSDvFNhethxhtuvbrDutvki/wD1I3+wb+b/AMV5h1Ucx4H9lX2o4pibzDQz5H5FM/sfsTPTdiHWaCSbgdkSSTeSInl3pQDR8j8l9E+xWGacLTw7so9owGmTF3uBc6mTwcJjdIPFJBfM+ovqP/Uut+SPO7S2a00RVZNhInvZBbKeMAtIPAuHupEF7XG4Z1Kk+nBHsiBEe63XX+B1QLxlWnlcRwJCzYqPzKSO3sOs3CVN8M12/viEtxkty1JLRcERLeg0KvXwIJLWlj8toIvI1sRx36QgStaziXZuIF+YABPmCs2Z23C+T0K06QboIvPC6KfjgSw1iSwGJBiLWJJBAvaY37lVmL3PaHjjo78w/WVsMOx/ceAT7r7eR0KCTvnmScEoWhk+GWR1V1ImQ5+U90ua3QaaPPJQ6kPiH5X/AOlC4nBOZYh7JM2c5rSdJ7JykwhamEn3z4hhH+W6dqm9W0ZnWx8VlGMup2+wfUpsi+UnmHT4GywfSaQIc4ATEQRePiA4cUnwxLKgBfTME2DIcfHJyG/SyftDXCQfPVaIp08rnPoxpbQcpVIbr0dn+oUtwVVrn1BlIEVGkObJLDYFs5u65wIIVtpsGYVG914Dh8/O/omgYOZO4ATJkW8p8l2Iwxi7QYm3eLbEkmNN/mnWJSyZXV2Er/JPvXp6CU1GmzgfBQypTbIBieMppSphjjEA6WM7/LciPvDvqyb4qLMkthYhaNPv9BLRxbWuBDgYP+6gYhvEDr/JOfbcS75j5LBtO8gib653C/8ACXx6W3Qo8RAR7GxWiSfavuAe2Zvc31Kr7an8XoP3Rn3C0RS/6RB9Hod+xp95o6Nd+r0PiKfMR7Gxi/h4r1Mxi6XE+v8ApW1DEB3cY53RpPmZgK1LZDRfM7MLgw2J3HKQZjrfkrHDV/8A3L+FhB8w6VPiafMH+Hxj/g+9eptkc0S5rWD+N4HylUdtSk2BnBMxZvZ0+Nw+QKEdsdpMve9x4kifUFaU9k0h7pPVx/SEfio8GXQ2Finqku30uF0MXmByvkZS8NHeIBIIBIgnlN43JDXq0Sf6MVJO6GgdAAXWTylg6bdGNtxE/OVs1saW6WSvE3NcPZ2p/KaXVn6Cqhiq/u0z1cYJvqXOiTdFYBtVrsznWmS2SZkyd0C/XxRgClVTqOSsjpYfYtOjJS3m33fveR7Qnefrouzn/dcWqpCzNtanVSa1LOph2oH18kNW2f8AD63RAVg8hGNSUdGU4jBUK6+ePbx7xVUw5B3oZwyODx2XNIIdwIuF6PD0GVDkqGA6YNrO3G5EDdIIImb6Fc/ZRBs94vBDoMHgRC106qllxPLY/Zs8O21nHy6w778cQ+nXpuJew9qkTuIh7Q3eHAu7TQTe/FbYp9Si6m4OY1tPO0OdIOQ3a72ernFrwOrbwAYRVNku3OYT+Et9WlY1NnVG6sn8L/0ctDtJWZx1k7ojaWLzulxOVxAJtOQG53XMkmN5MJs3b1M2Dm9HMB9XNSF+EnvB4639dFgcK3c5GLsTM9I/EUqmopE/wnKfJhA9Fl91pcHfn/kkBwJ3Qq/cXJ95cgZnog1fQqdKn/w/Dy/K7sFsd7sMc0uHCCRc2Xgcp4eq9p9nmZ8G9wLc9OWBpY1x3vZ2nbpnsxEiTKWA8m92wy2jjvvFJxh8PaW5nAGW5S0mm8NEtGZt7nQTZfOqjs0O4gT1iP0X0jauJyYKk4uJc6kKjjYF2ZgIBDQO6C4wOJ4r5hh3zIO4x9eRVOJjkdPYs7Ym3NP1NVq67RyMeBuP+5ZBa0eB0dbodxPKY8JWBM9c9LmalSB5ixHAroRGWeaCsLtB7LTLfhdcIlrKNXT+jdw1aUsUoE3OWRgNhkVS9xlonu3vcX4BGNjQTf64qaGJc3Qo6njWEOLqbScpi3vGwNuEz4KTbnqU0MNDDRaprXMb7JxtLC4YVDkNauHhstnK0EsBI+GWvP8AES3XKY8/QcC2HGHPJzPOmXWNeIHmUr2jifZiRGZ2g3Acef1wSbDYKpXebk8Sbxy/kraVFyXQcfFYynhakkvmm830clx0R7OtgznLWlrzA7ogG1stgDPK5PNCuYRY7ljgth1qIzMa5wGozBw8WER/uj8JWFWWukPHGcwjjvc3zLeYCapScV0GvAbYp1WoSVn+/vqCQpDEZjdn1KRAe0iRI4OHFpFnDmJCFCyyTid20Jq6zRmWwo9oURCqWJPeJ6oG5bQoHhaBZmkFUiFN2LWRE2tTbKoNNUa8q4qJbNDZFCxQWraQpLVN9hsDwuWxaqlqZTQLFFytlUQmUyWKworNdlzRyBg5Z1ifrVXhXDjlIvlMEjcSJgkcRJvzKN0VVKbcWouwJh64eLajUHUI4V3AgkDuhsQAC0WgxE9dd8zdLMXhiDnZ3h68ijBtI1w0u1Y0MjSA36J80ZRy3o/0c+nVlv8AuKyz58JL15o1qsgyDY6TqOR5hc79FDmh2UkwWyJ3RbXiLX8CLgKzrEi8hbaNXfVnqeb2ls+WHm5RXy+QK5t1DqM6ifX5rY6qSFeckCfs9m9oHS3yWf8Aw1nPzcj8ij2YUIc5qM2Ptf2DnBx7FQQ6PdI7r+cSR0cUPUCxcwFNHLMLHn2p+0VM0aTWvDnhrQQ02aGMyEkjebwP4pXicFXiS4976v5lbYrZ97EoSphHcT6JZreyY9CrKjUVSOqGzHKz3AalJqdFze64j64GytQxDtTefP65LL8Nnrkd7/PLcyh83XkOH1pIdyh3Pn1/nxWw4oCgWvmHZSNBe/Jb0HEWN28Ru5kagKToNaFuD2zTk92ot3y/BtC5WhdlWdo9ArPMqplWhUQ0CLNoML6oYDckNjcLT9dF6nY2yBka4yGasAgFw+Ikgw08IkzMjen2XgjVxeQScxa22uUgF8Rvytd5r3+22ewY3M3tPNm6WG6+gJLR0ldKkluJ9B4DGXeJnz3n5muB2M0021AC05S4Zf8AmPZY96YaDGaL6GwXn9uYIOLHNLcxBLKzSMrssQ0xa/a04aC4HuNj1CcNSB/s3G+s5mm/mV8/2S3L7bDO7NMPcxp0DHtcWteOHdEngbzCsehmV4yfNGmzdsPDCCA5uY+0o1AXU828xqx0+8wg6c1tiNnU6oL6BLCO9SqESLj+rqd2o2++HW0dqk73nMXEQ6fZ1RvnRriOtl1J5YZBIPIweoIXNrR3Hbgez2XXeIpb0XaSyfT1rp7+ws+k4WLSOoIUMeQQQYIMgixBFwQnDMfTxADcQclX3cQBrwFdo73DOO0LTKQbY2VWY8EF8n3W1CGVBMZ6bgYN+FrdQc6pKT1OhWxU6ULuF2tVfhzXPq16AuvXLzLjJ4267lmmWzvsrWfTbUzYhrXNDpe2lIkbw9oOs9YneEp2vWZhwRnDny0ZTlzXa8uc4U3AAAimLHXNyKueCqLNNHMp+0OFeTi12L1JNPgq5VbZjKtcZqTKbhIH9ZkIJLWgFpaYu9u8i+qK+7ug5m91pcSCDlA4kx9W1SvD1VwNcds4OX8+9P0A4Ugpm3YtUjM3KQG5zDhLRBcQ4e64BplpuPKQnUHXsez3t+WdM0d2eeqqlCcfqRspYqhU+iafajMOU2VVyqNWZMLoXKQiSxWFOVTIXNa4zlBMa6mOsKWA7IhrBeeB3AyeBuIHO/RK6+Hc2o11PWbjlzTU0jvIHj6Wkq9MAaieRkDxi/qrITcGZMRhliEk+DunxXUVoUxMO6H5LKqCDB3W8kRUeXbgOQAAHgFlXMm/AA+FkYzs8i2WH34tTzurGAerhyrVpwdVXKutF3SZ87r0/d1JQ5NruNcwUzzWQC5EpF4rVKdnAvaPF4H/AHBM8C9jxmaQR9ajctHUw6x/n4IDEbOcw+0YSD8Q/wC9u8c0Q2GtaiMqXPpclbDbV92qMp3O90+O5EvCjZLC2phkO7CxNteqbkLF8IXC4ip9AcD5qRWI4nqf5Iqp0Q76coiBOHxgMAQBpB+ro8CIkRPkehFj4JExhaQ4aggidLXvyR1faWUj2YIaQczYJHK2k8SFXOjGefE6WD2pWw3y6x5ejG1JoKIOzBlLhuBP7JVhce13dsfhP6fXQJnhsTnOUa27JsTBBhZJ0pR1PSYfaNLEfQ7Pk9fz2G/2PwbTjSHzAbeO8OwGyDuIzFet+0WAYYbVaTABFWADxElh7uhnTWy8z9hq+baFSd5PpY+oXudr7SFCu2nWZmoPaCD71N2ZwJB4WBI8RfXdTypq55PEtyxMnHXefmAbAcWsYwyQ3MQ8iGuZcOMwAYDgfBeS+1TCKjnUm+0a4QWgOBzA3JESQQeREdQffP2cyliA1odBh4aXNN3HIXZWzDcrpM3IjSJC2pQotY8+0qHcwy2mARaC6YMWk5b80ynFtwWqt4mWV2958TxGJZNVpMgYinlfO54sS6/es155v3oNxORjpmQQbgw5ri1wkcsrv74TL7T4pjqTMtQvfRqMDnXiajXZokzrRmDpMCUuqVgX1WmwcRUb+Jwk6Wvp4BU14b0X0HT2TivcYmN9JZP7Ps9Sgcmmzdp5W+yqt9pRJnIbFpPv03asd6HeEpUhczTQ95KCmrM9rsradaiAMLV9tT+Fzsr6TeBpFrpie83s8wtsR9q84h7KFQncHUc3+Os30heGBRw2rWgAVIji1jwfxZhPiCD1W2jirfLI81tLYUpt1aOb4rS/Tyv3D1mKLTNPBUzNyfZ5XyCCDnpVXybC4I0STadelWaWmlVZMWp4h4ba/ce1zfRYYzHu7Jdh6FYR2ow7KhB5Q4OA69N0kTE7fpuhooZS20BrmOj8IDgI6qypvyzpy7Dm4Z4em/d4yjbpzXf6oJwFerRJNKvVaDu7G/XN2YcPAKdoY2tVe15czO3KA8DI+BmkAtGhzQZmYG8ShmY2mf7Vv4qToHiPnC0p16bjAq056uHzFlkdbELXyO3TwGyqmdN90n6jrC4mmWAPq1GPAPajM0xMAwbzb3R1hCVMU8EgVMw0kCx5jMAfMBDiifiZ/wBSn/qWowNXdTcfwjN/llZ5OT4HXpU6MP5X67P8lDVP8P5WfsuFY/w/kZ+y0GCq/wBlU/I79lxwNUWNKoD+B37Jcy+9J8vAj72/4j4W+Sye8u1JPUkq5ou+B35T+ykYd+5j/wAp/ZTMZKms1YxTHYmMZTeRVYH0njK+0uaPiYeI4SJ3EGCB/uNX+yqfkd+yj7hU1LC0cXwz/PCiTK6rpTg4yeXWVxzGB7hTcXMnsuIgkcxx+raLJjZtx067l1V9Jgl9T8onwlxA8pQlDapeXNpDKwiHEwXOn3QYBA3nSYhWRptq/AoqY2lTtTveT05vp+74F3NkmN38hP6rRtHifAaqgtaZFuO8TF+H7q4XSpSTgrHh9o0ZU8TNSd7u/fmWEDQfqfrop9oeJ81Aauyqy5iKAhFUa3I8/wCSBat6fVEhni8E1wJAAnduPhuPNKw19MwJI+A/9p+vFPQs6zA4QQCoRIX4bFNfYG41B1HgtnMQ2M2fN720c2z2/wCofUhZNxj6f9Z2maCo0ej27j9CdVLDX4MIcxZPYipDhIMg7xdUFJQVoDdTWdSkmBprMsRFsK30VtRxTm2PaA46jo7UIp1FYmgeChEPfs3tCmysx4IBLodLYqEGXaizhIAk3uF9K+2dJtT2D3Rlae0PiDm545iWkdHFfF2DKQQYIMr6Ts7af3mjQk/1YLXje51hTgnlMndB4JlmrEbd97iMGsdiahmTllrRMNzmJB5Bs5iP3gD7WYENoVajS5zmh7WNcQAIeWNPllPON6XY7Hvw+JpFs5aDml3FwPeaORDjfeT5+n29hg+lVYDIdJaeIezsnpInxTlbPmxw1NmFqBocAX0z2omYeAZG+LxfegG1u20newDyjTyR+2KxGFa05RmqWhrWkimwglxaJdes3UnQ80lzQW9D4KscaqQiKDOw2dco9Qq1WrkyWbPpOGquVOLlrZeRmFpSMEHWDMLNcEjNZ7LE7Bw7aAxRe+rTcIPsaY7DyB/WBz+yBEa6ndaUEUSAPa1ha802keXtdPNY7L2rUw7s7KjmDR0GARpcGztdCCh9p/adr5DMNRJmQ/K6mbzupuGa868LcrYwc/pRxsRiFhHavO6eml7f+beISNlUH/8A5cODwqUnsPQljCB+ZUP2Rabsbhn/AIK4n8pfPokL9s1zp7Jo5UqZjf3nAmY5nyusn7RxJ1r1R0cWxad0AWWiNGouPizi19qYSTyp364x+1h7U+z7qVzQrNHMDL4OdT/VUNFg1a4Hjn/7QAF5t7HEy57iTrLiTz14cTx8FT7sOH1w5/XOH9xJ6y8LlC2ph4/TR7pOPkejr16IsCAeLqjb/wB0AQh/+JMaZFQA8if0SQUR+0fMceqj2X1+nTif9kvwkeLHftBVStGC7bs9BQ24XODW1nybDtOaJ4S4hZVftCQSHVqgIsR/SZgRYgg6JGae8a/MaJhQa3EAU6oh/u1AO1Yd1494c9RzFkywsOkpe3MQ+Ee78kVtvg/G48/5oCttSo7SG+pVMZs99J0PbGsH3XRvB36jpKyDU8aMI8DPV2piais5WXRkH4Wm6sddO8TdPKFINAa0QB9Sea87g6xY7MOi9NhO2GkDX04+UHyWfFb2XI7Ps/7iTk3/ANOb5dH3NHiDYb7ev8lLakaghWMTbT6+vBaUyrqMd2CTOTtOuq+JlKOmi7CoeDvVoVzh2nUeSp91HNWZGDMEatmlUaFq1MAsG812RWCu1iAyMsiwqYbe2x0PAjeCN4R/s1EN3z4IDPM8/UwRYS6kRTfqWH+qf0JPYPpzaLLbDY1pdkqA06g1a7f0O+fqU4qBhEZfMnzHBL8Xgg5uVzc7BMDRzJ3sdFvUHeCmWYlmjf7sqmiBvnpZLmPq0QS0mtRFz/a0xxcOHO40u3RHYXEMqDMwg/MdRuUJkznEDRo+fzWT76opzFTIiKxbWoo/7NbYOFrBzgHM3g+IkE6ESYO7oSVLqSyq4YEIoB73alCniGCo10g6PGo4tcOI3g3Hir7NxwZhxSqEZqZyB3/6iCQeWVwaPwlfNqOJxGHvReY0iTpwtqORkKuI26+r2a5fH8Lg2/NuWD6dU28CxO3caKtSKYimwZWACBqXOdGnac4nyQ9FoL2hxAGh3DpynTxQ1Oo1tyQTyufTRVGO7U5XWIIILZEfwuBB6JHmNFpSTauepc/msarkhZjHe69hG8ZWUXi+73PU9Fq7aTmznbl4NeHNceYIbEaLFLDyWmZ63D7ew7/6RcX3r18BqFliMTlkBpe4CcrQSQOLo7oQ1OvVcJNN7GRJexrnmInvRDLHWCisLjaZAFNzQNYBi/Ezcu5m6qdNxzkjfHaMMTeFCaj0vXsi/N+InfinVLk3E9nQDW43zfj4i6kEX0Ii8QRpJ5d0DU79wsfRPcHd9jXxvI7Q6PEO9YWLdkUnXbMz3SY4d06HpYzEStEMVBK1rHCxOwcU5uW+pX4tvx1Ehd59T1O6dY0G6+5qq4nyPrPjBzdT1Ojv/hjAYLTI4l0+Inr5nipGDpiOy21hYGN0XQeMhwTBD2bxL1lHxf2EX1+3mZv5b3K7aDj7rjPLX9503COWr5rQNIHSAtaVBz5ytc6NcoLo6wkeN5RNMfZtLOdTw/IhGCqHdHU/RPlz1gDVuzCdSB5npw8v907+6v8Agf8AlP7Kr6caupjrUpjzlyR4qq9EaobDwNPOcm+tpeVhZT2Y0alx9BPEomlSyRkc9kfC9wHWCSPRaOxFIa1qfhnd6saQfArM7Qoj3qjulMAHoXOBHkgviJO+Y8obKpR3Xu+b+7IxntKjPZvLHiWkEtyvbAgZS0hptIuNPCEo2VUmItxlo/X904O1G+7RJ/G8keTA35qRjap0hn4BB/Pd/qtUPfv6rHDxK2WnenvdS072mDYfYgbBrOA/huJ8O8fIDmmDsSAMrGwOJAzRwEWaOQvzKFZTVoVqpZ3lmYp41qLhRjuRevFvrf2VkGMC3ptWNLciGImVG7QuyonZ+AqVjlptLj5AdSbBOv8A0ViP4f8AF/pVTnFZNliTZ49tNaNA4+SG9pKs1yuK0F+0HBR7UrJquEAlpXKJUSoNc4ldKkBQSoQzqUL5gS1wuCLX42SzFYAF2YH2NX42jsO/E0adWjq0m6b+13QqubPMJkxWhVS2i5hDMQ3KTo8XY4cQRaOYtxjRMgAdFlVw9i2A9huWOEieI3g8xB5pezCvp3w5L276LrvHHIR3/AA/wnVG3IW/Mb+zUimhcBtJlWwMO+E6+HFMWoEBH0ghKuF5JpUKxIlQAmqYMcEM/Bjgnz2LJ1CdyhBA7CqrWuaIBIB1Hunq3Q+KePwnEj9Vg+iOChBS0XnKAR7zJYfCOyD4Lepi3O7z83/NYyqR/fcMwHQIh9CVkcMiAzp1hMhlPnkqVKf/AMj48gmuB2mxrS11BtTUy/FU5EgCAWASBEgXiTxS37ouGASuMXqiyFapD6JNdTaGtXapMBjmUmxcPrUqzbaQCyQegUUtrkOGbFjINRSpkO6N/og3xJSwbOWjcCFFThyQ7xdd6zl3sOxO3GT2KmKPIvj1BkeqCrbVc73Xu/5lWo8eUhXGD5K7cOOCey4JdxW61R6yfewJ9Z7vdpj/APmw/wCYFZnDFxlxJPNNBRWgpBQRtvUWswiIZhAjA1SoQxZRAWgarAKcqhCq5UxFdrB2iB8z0CDZXqVf6puVvxu08NZ8AfBQgzrYprB2nAfM9Aow+Je+7W5GfE+09Bq7wB5kIfCbPa05r1H/ABPuBzDTI855QmTacmXGTzv/ALpWktRk29A+jtWqGZKbiBvdpPgNPVD9v43eZ/db0acrb7ukTt9OQ7V9RBTWrVy5MKjVqsFC5AJIViuXKBOVSuXIkKran+i5coQ5Lsb3z4LlyMdRJC77Sf8A3z/xs+TV6VihciyIh6zK5cgAhanRcuUIB4jVZVVy5Ehi9VauXKALhSFy5EhcK7Vy5QBU/uoXLlCEhcFy5QJK5cuUCcoXLlCHm9qf1r/BenxHeH4G/JcuTIR6mlHRFUVy5UvUuWgxwyuuXIIY/9k=',
  '/rent/ferrari-sf90',
  '{
    "version": "SF90 Stradale",
    "electric": false,
    "color": "Rosso Corsa",
    "theme": "racing",
    "horsepower": 986,
    "torque": "800Nm",
    "acceleration": "2.5s 0-60mph",
    "topSpeed": "211mph"
  }'::jsonb
),
(
  'mercedes-maybach',
  'Mercedes',
  'Maybach S-Class',
  'Роскошный кокон с массажными креслами, титановым аудио и шумоизоляцией. Для тех, кто предпочитает расслабленный автопилот и тишину.',
  2200,
  'data:image/jpeg;base64,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',
  '/rent/mercedes-maybach',
  '{
    "version": "Maybach S-Class",
    "electric": false,
    "color": "Obsidian Black",
    "theme": "luxury",
    "horsepower": 463,
    "torque": "600Nm",
    "acceleration": "4.9s 0-60mph",
    "topSpeed": "155mph"
  }'::jsonb
),
(
  'audi-rs6',
  'Audi',
  'RS6 Avant',
  'Универсальный монстр! 600 л.с., полный привод и огромный багажник. Для практичных любителей скорости, которые не хотят жертвовать функциональностью.',
  1900,
  'data:image/jpeg;base64,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',
  '/rent/audi-rs6',
  '{
    "version": "RS6 Avant",
    "electric": false,
    "color": "Dark Gray",
    "theme": "performance",
    "horsepower": 591,
    "torque": "590Nm",
    "acceleration": "3.5s 0-60mph",
    "topSpeed": "190mph"
  }'::jsonb
),
(
  'delorean-pizza',
  'DeLorean',
  'Pizza Time',
  'Ты начинаешь день с доставки пиццы? Этот DeLorean модифицирован для временных прыжков - гарантируем горячую пиццу в любой исторический период! В комплекте: хронокалькулятор для расчета времени доставки и антигравитационная коробка для пиццы.',
  1985,
  'data:image/jpeg;base64,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',
  '/rent/delorean-pizza',
  '{
    "version": "Modified",
    "electric": false,
    "color": "Steely Silver",
    "theme": "retro-futuristic",
    "horsepower": 300,
    "torque": "250Nm",
    "acceleration": "6.5s 0-60mph",
    "topSpeed": "90mph"
  }'::jsonb
),
(
  'trabant-polka',
  'Trabant',
  'Polka Special',
  'Выбрал "громкую музыку" и "бензин"? Получи культовый Trabi с встроенной польской дискотекой! Двухтактный двигатель 26 л.с. + аккордеон на панели приборов. В багажнике - бочка квашеной капусты и пожизненный запас pierogi!',
  299,
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPYAf8CE0FvePYGUXDxEX241cGBFQWpKdI1g&s',
  '/rent/trabant-polka',
  '{
    "version": "Polka Special",
    "electric": false,
    "color": "Forest Green",
    "theme": "retro",
    "horsepower": 26,
    "torque": "40Nm",
    "acceleration": "30s 0-60mph",
    "topSpeed": "50mph"
  }'::jsonb
),
(
  'hamster-wheel',
  'IKEA',
  'ÄNDLÖSA',
  '"Спокойное утро" + "Экологичность" = Каршеринг нового поколения! 100% экологичный транспорт на хомячьей энергии. В комплекте: 3 тренированных хомяка, автоматическая кормушка и сертификат на бесплатные meatballs.',
  50,
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7SZu49gOBySnUKWPAogCGXEAskvQIO_m-gw&s',
  '/rent/hamster-wheel',
  '{
    "version": "Eco Friendly",
    "electric": true,
    "color": "IKEA Blue",
    "theme": "whimsical",
    "horsepower": 1,
    "torque": "2Nm",
    "acceleration": "20s 0-60mph",
    "topSpeed": "5mph"
  }'::jsonb
),
(
  'lada-kalina',
  'Lada',
  'Kalina Tarkov Edition',
  'Для любителей "тёмного салона" и "полного контроля". Бронированные двери, встроенный генератор дыма и система защиты от скавенджеров. В бардачке - аптечка, банка тушёнки и бутылка самогона первого перегона.',
  999,
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRULSI3j-M1aYi76zDBegqSYUOQu93l-ol8Ag&s',
  '/rent/lada-kalina',
  '{
    "version": "Tarkov Edition",
    "electric": false,
    "color": "Camouflage",
    "theme": "tactical",
    "horsepower": 70,
    "torque": "100Nm",
    "acceleration": "12s 0-60mph",
    "topSpeed": "80mph"
  }'::jsonb
),
(
  'cybertruck-toaster',
  'Tesla',
  'CyberToaster',
  'Выбрал "космический экран" и "технологии"? Получи кибертостер с автопилотом! Готовит тосты во время движения, Wi-Fi в радиусе 0.5м, броня из нержавеющего хлеба. Внимание: может случайно разбить окна соседям при парковке.',
  420,
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBw8PDQ8NDRANDQ0NDQ0NDQ0NDQ8NDQ0NFREWFhURFRUYHSggGBomJxUVLTEhJSkrLi4uFx81ODMtNys5OisBCgoKDg0NFQ8QFysdFRkrKy0rKys3KystKysrKy0rKystKystLS0rMystLS4rKy0tKysrKy0rLS0tNy0rKystK//AABEIALcBEwMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAADBAACBQEHBgj/xABLEAACAgEBAwcJAgcNCQAAAAABAgADBBEFEjEGEyFBUYGxBxQiMmFxcpHBQqFjZJKiwtLTFSMzQ1JTVGJzgpPR8BYkNESDhKPD4f/EABkBAQEBAQEBAAAAAAAAAAAAAAEAAgMEBf/EACERAQADAAEFAAMBAAAAAAAAAAABAhESAxMhMVEiQXFh/9oADAMBAAIRAxEAPwDzVZcQSwgM8T6gghFghLqZkjLCrAqYRTMtDCXWCUwimCFWEWCUwqwIiiEAlFhFmSsBO6SCWEk5pJpLSQSukqRLmVMUGRKMIQwbSQZg2hGgmMQo0oZZjKEzSUaUaWYwbGIVaDMsxlDNBUypnTKGIcMoZYyhiyqZUzplTEBtxnZxuMk0wZUy4g1lxMOgoMsDBiXECIDCqYFYRYNDKYVTBLCqJlCLDLBIIdFhh0RYRROKsKqwWoBLASypLhIDVNJNIXck3JYtAIlSIcpKMkjpdhBtGGWCZYrS7QLQ7iAcRxaGxg2Mu0E0UqTBsZ1jKExDhMoTOmVMQ4TKGWMoYhUyhlzKGaCplTLGVkyG3GSRuMk0yZUS4nFEuBMOjolxOAS6rAurCoJxEjCJAoiwyLOpXGa6oJytIwiS9dUarpgNBSuHSqMV0RhKIDSq1S4qjq0QoogNZ/NSc1NLmJDRJayzVBtVNU48G1ElrIeqAeua70ReymJ1kukWsSatlMVsqidZrrAMI/bVFrEiSbCDMZdIFligTOGXIlSIoMyphCJUiLIZlDCkShEQGZUwhEoREBNxnZ1uMk0ydUS4EgEuBObo6qwqJOIsYRYFESMV1ztaRuquZTlVUbqplqqo9TVDQHVTG6qIammOVUzLMyBXRGUx4zXTGq6ZMzJNceEGPH0ohVojjPJm+byHHmpzEq6qOJUe8gRwcmW2PBPjzQtyKF9a2hffag+sTt2phjjlYg9hyadfGWGJKPjxW2iOPtjC/peGPfk1DxMPTSLhrQVuHbSy2j80mGS1rBtoidtM+kyNn2DjXYPfWw+ky76ZNRLDtqidtc2bqojdXFplWJF3WaFqRV1miTZZQiMOsCwigiJUwhEoYhUiUIhDKkSAREqRCGVImgA3GSWYdMk0y0FEIqziiGRZzdFq1jNaStaxupJiSvTXHaa5SmuP0VzMyFqao/TVK01x+mqZ0SY2ds2y0kVrvaaanUADvM0f9n8z7C4yjttufX5Ip8Zr7MAqqVRxPpN7WMc85lyhzmZYCcms48cnDr/s6LHP5zQq8k8k+ttFwOyvEpX7z0zbGRM3lLtvzTDtyBpvgBKgeu1ugfLj3TdZ2cZnWbnbExqP+L2tkVE9OhvroJHuHTMyyvYY/hNq5j+7KsYfcs8p2hlvbY1ljM7u28zMdSx7TFC89PbhjZ+vWWHJn7eVkv8AEb2/QhsPD5K2MFW1d4nQc7ZdSCfewAnj+/KK/H3x4VWz9folfJ9sj+jkj+3u+jSP5PNkH/l3HuyL/wBaYHkl281+C2NY2r4bhF1PT5uw1T5aMPcBPuRkTzzbJw5b6+N2n5JMCwHmLcjHbq1Zbk7wRr988w5Xcgs/ZZ846LaVPRlY+8CnxDis/Qi3y7MrqUcBkYFWVhqCD1GMXXl+e+TflDzaCEusfJrH2XbWwDtVz0k+w6909I2fylx8tFLCu1W4b6gn2jtBnn3lS5F/udeMnGB8zvb0RxFNnWnu7J8xsfbPMWdO8K205wDp0/rj2j7x0e7pNeUbX2YzfL2rN2BTcpbFPNvx5t21RvYCekd+vdPj83FZGZHUqynRlI0IM2uT22N4AFgdQCrA6hlI1BBm3tnAGXVvoP8AeK19H8Io+wfb2ThE7/XTZrPn083uriVqTZyK4hcknVmOsA6x2xIu6zSKkShEOwg2E0gzKkS5E4RIBESpEKRKERBduMkuw6ZJphpoIxWIsjRitpzl0NVLHaUidRj1BmJJyhJoUJE6Jo0CYkSboSaFC6aH2iK0CM2tu1k+1fEQn0z+2k2aRw8P/soNov2D5D9aIKQw6fpCV46/6Wv9Wc6yrxG+D67QbsH5v60weX7i1KMdy40U3OK1sI1boX1UYcB29c3MXDUsBqeI19Gvh+TPJuVnK2yzNvdFrKc4yV6vkeovor6tgHV1Cero13zDjacWfY1X41x6qcg/+iVOw6fxv/Ayf2Ewzyou666D35P1tk/2pfrooPfd9WM7TFmdhufuFV+N/wCBkfsZUbAq/G+P8xf+xmKeVJ68ag95+oMqOUi9eLT/AOP61mWXWw+/5D1DDyyU840urathbVaqdHpAkmtQOB4kcZ9/+6p/B/lp+tPBKOUyo62Li1B63V1K+bqQynUaHmdRw6p7dikW1V3JYSltaWId606qygj7ftnDqxMTstR5PrtU/g/y1/WmjhZu/wAdO4g/WYgoP8s/O79pGcZSp9bXvsPi5mItBmGxtjZNWbi2Yt43q7V0106VbqYe2eL5nk+pqsatrMoMhIPoKfpPasbK6ND+j/lPmPKNWK8Y7QWtn5kAXqi4+9zevr62Vt0Du6J6unarlMS+Hw9lea1gVvdYEJI5ysgqnEgaDgOk9Ptn2Oxs3eUHWeYPy0p/mb/ls7648+m5L7bS1Vampgjag85lgsrDiCBT9esTHX6eTyh16dtjjLY5V7MAPnNY9Cw/vgA6Es7fcfGfJ3JPSav36tqrFUJYuh0ffI7CNUHSJ59tChq7HrcaMjFSPaJydKT+mRasVsEeuidkYdCziCYQrmBLTSVIlDOlpUmIcMqRLEyhMQGw6ZJxj0zs0ydQGMVgz6Crk+Y3VyfnCbw6YwKlM0KFM26tgR2nYmkzNoTIx1M0sdTNGrZAEcq2cBM6JJ0LGrqiamHs1+XTHa8MCM144gxLEx0Okeprnwe1eWWViZV2M9OO3M2MoOlilk4q3HrBB75ynymuOOJUfdey/omajo3E3h99trK81wMrI4FKGVP7R/RXxn55ybNSZ97yr5e+f4fmi0ebk2rZY3Pc6GVQdF9UdfhPgnx9ev7p7elXhXz7cLeZKkyusYOKe0ffK+bN7PnNsYBrOiF83b/RnOZbskslQT23yZZ/PbKrUnVsZ3x2+EHeT81l+U8U5o9hnovkd2gK8jJxrWCJdUlyFyFXnEbQjp6yHH5M49eu0/jpTxL1CEQy6bjeqyN8LKYQUdk8OOq9LzQVFsRqrAGSxWR1PSCpGhERSoiOUaidqSxL8zcsdhts/PvxG13UbepY/bobpQ/Q+0GE5HbU5nJFbHSu4gfDb9k9/D5T1Py47A57Dr2jWP3zEPN3aDpbHc8T8LadzGeGa9PZ7RxE9cfnTJYicnX6K2Tk7ygxDlps/eRctB0jSu7T81vp8pi8hNsc/QjE+mPQsH4QcT39B7593Wq2I1dg1SxSje4/WeGv42msvRM+rQ8mvUxK0GfX5exGVmXobdYjeHSG0PERG3Yrdn3TfJ1iHylgMA0+ns2I3YflFn2I/YflNRaFj50zhm4+xW7D8oJtkN2Ga5QMYpMqTNdtlN2GCbZrdn3R2BjHbjJNB9ntrwnJvYZx6nXYIylgmNXdGq7p5eLbWSyGWyZaWxhLJcQ0VshBaYilkMry4s6a51pw22dWkorQqmWDXz3KLYi5hVrqa7HQEK+/bWwB6iUI14des+P2hyDvPTQKk6eBtsYad4JnqoAlt0TdbWj0JyXip5D7QHFaCO0Wtr96wNnJHOH8SrfDYv1nuJQaRd6R2Tp3bMcavC7eT2cvHGsPwtWfrANsrKHrY2QP7hPhPdzQvZKebL2CXen4eEPBmwrhxpvX31OPpAWKV9YFfiBE9/OIvYJVsBDxAl3p+Ltx9fn/AH1/lCTeB6wZ70+xaG9atD71Uxd+SOE/rUUn/pr/AJR78fF2/wDXhfo9g+Qhky3X1XsX4XZfCey2cgNnn+IQfDqvhFrPJrs8/YdfhtsH1j3q/Bwn68qTbGUvq5WWvw5Ny+BjVXKnaC+rm5g/7m0+Jnob+S7CPB8hfdZr4iLv5KMfqyMod9R/Rj3aDhL4fL5XbStqemzNybKrEZLK3cOroRoVOonzpWeqt5KKf6XkD+5WfpOr5Kcfrysk+5ah9I92g4S8yxMmyvXmnsr10J5t2TU9xmnRm2t/CW2uP69jv4meh0+S3CHrXZj+znK18Emli+T3ZlZ1NT2H8Lc7j5a6TM9WpiknuRVLNs+o2jQkuUBGjCvXo1+8+4ibRxE7BBYuLXUoSpVRRwC9Aht+eafM66hNgp2CDbZydgjPOTnOww7JFtmJ2CCfZKdgmibZU2SOyyX2OnYIB9ip2CbRsEG1gkdl8xkbGXfPR2eEk2Mlxvnu8Jybga+VqtjVdkyqnjVbzpi1qV2RmuyZlbxiuyGDWmlkOlkzkeMI8sDQSyGSyZ6vDI8sZaKWQgsiKvCK8sEnQ8qzQAsnC8cApM5rAb8geWHTGskCHnQ8MWjCEWLh4RXhi0fWd1gN+Tfhi0fenGeALyjWRxaJZZA87A2WQJshjUHOenDfEjZKNbLCdN8qb4ibZQ2w4k+ciVORM9rZQ3SxNE5MociZxugzfLC0jkSjZMzTfBtfLiTGRkeme7wkmXfd6R7vCSa4ssWt41W8zq2jVbTrgaKPGK3mfW8YR4YGjW8YR5nVvGEeSaCPDI8RR4ZGgDyvCq8SVoVWkDYeQvFw87vRAu9JvQO9JvSRjenQ0AGnQ0kZVpcNFg0sGgh9+Tfgd6cLwxCl4Nngy8GzxxOu8CXnHaCLSxpcvKF5QtBs0sK7PBl5Rmg2eGIQ2QZsgy0oWlhENkG1kGzSjNLFojWQbWQbNBs0cOh3Weke7wki9zeke7wkmsZZtbRqtogjRhGmkfR4wjxBGjFbwTQR4dHiFbxhHgDyPDJZEVeGR5I+rwqvEleEV4A4Hnd+LB5bfkB96TegN6d3ooxvToaLhp0NBGQ0tvxYNLb8kPvzhaB3pwtBCloNmlC0ozRLrNBM04zQbNJLFoMtKlpQtIus0GzThMoTJOkyjGcYwZaOJ1mg2aRng2aRRmg2aRjBsZYgLT6R7vCSDtPpHu8J2aDKR4wjySRRhGhkeSSCHSyMV2SSQQ6PDK8kkkKtkKtskkEuLZYWSSRDvOSweSSSdDyweckgFxZO85JJIpzk4XkkgnDZBs87JFBNZBtZOyRQZeULSSQKhaULSSRSheDLySSShcQZcTskkGzQbGSSKK2npMkkkWX/2Q==',
  '/rent/cybertruck-toaster',
  '{
    "version": "CyberToaster",
    "electric": true,
    "color": "Matte Black",
    "theme": "cyberpunk",
    "horsepower": 800,
    "torque": "900Nm",
    "acceleration": "2.9s 0-60mph",
    "topSpeed": "130mph"
  }'::jsonb
),
(
  'fiat-esprit',
  'Fiat',
  'Esprit Shaman',
  'Для сочетания "механика" + "V12" + "аналоговые кнопки". Ручная КПП с магическими рунами, двигатель на эльфийском эфире. В салоне: хрустальный шар вместо GPS, шаманский бубен вместо парктроника.',
  666,
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxMTEhUTExMVFhUXGBgYGRcYFR0fGhcaFhsXFxgYGhcaHSggHR0lHxgWITEhJSkrLi4uFyAzODMtNygtLi0BCgoKDg0OGhAQGC0lHSUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKgBLAMBIgACEQEDEQH/xAAcAAABBQEBAQAAAAAAAAAAAAAFAAIDBAYBBwj/xABDEAACAQIEAwYDBgQFAwIHAAABAhEAAwQSITEFQVEGEyJhcYEykaEUQrHB0fAHI1JiM3KC4fEVkqJDVBYXZHOywtL/xAAXAQEBAQEAAAAAAAAAAAAAAAAAAQID/8QAHxEBAQEAAwADAAMAAAAAAAAAAAERAiExEkFhAxNR/9oADAMBAAIRAxEAPwDybMQqD1MnzMflXCsNM1Jj9MgGsW19iZJH1qNgen+9ZaXeIvK2TAB7s+8mo8SCASOQt/WnY8H+UCdlAHpUnEwYPWbc/wDZUVFYIy7TqIEaz0qz2ruRiGBnNlUN6wJ/IVDhg2RCoOt9RAO4jb50u0LNdukkAEfEec/3TuaT0vi52caVxCgRKrJ5bjfoKqcVRi5MQJO2w12FEOCID3xUlQFtqwB0aTrM9aH8bY96VAhQY3p9r9KYAJ3Io/wmwe9ZVE93h3U5dJYDMZn1gjyrPYf/ABAPMfiK0nAWYYm7mzBLiXwuh8ROggDWPMaUsIohCMOzRBDuI9QhFDHxjXWExMQCB7bUTvOBhmDEmLj6r5hZEt6amKoYVIIbusqyPE0sdekgLyPKrIzat9prYN5lXdAin2Ua0W7P3WRSPCJtuJJgarFZ7iuJBvO+cuM3hGp8PqdKtWsegtlTauZiNGDHn1h9vKKl4r8u0dxh3Gh+8fyAqzw2z3ZdpBfISByUHcnz6CqKXgVylbkgyIBj3A57axVjBFctwMzq7fCSpiI2Jy1bDRe25bh95mmGuWueu5IPmKp8Hwsd5cUqwt2y/wAgdIPrtWotdiMYcLCpebNkYZQhQrE/FkmeYgxWYUCz3qM+R8sFWK6zBER1EH3rOGrnZ2ftKksAUWR5ysfOTXOEYcMcexMFbF0g+ZYKPz0qjwy7F4t39lNPiMGNogZxJp2ExeW1iFF1Q1wW1KlSc47wFiGDQsaHUGZjTWmLsVuLQGAkaqs/LT0qPDrCqDEBixPXlFLiKE3hIBJXSNtOupGx5E7U5gFCrm8IUnTc+dU3sKuMT1rYY7DFsTh7ew7q3OumkknyrOKRIyD33Ov4VqsTcXvL75tFsJaUncZ9DE8xr86nKkAsU/eu9zSCSSTsBOkCorlweBRosyep11mpL7eIrEKDAA28yTzNNFsSOgpBWvAanqaYQO7On3h+BNSYkwBprqfn/wAVGdUAOkkn8qqNFxmyBZw5zT/LkHmD4dD5ChC2c2YEwAFJPQb0c7RYdhbw0gAugAA5KOp9p96B4khQwHwkjMSNWjp5CpGqia53hAQQBoo5x199zTsWAjMJkzHkP1NLB3ZKhZAkepj8qlu5VzO4ztmJGvh5/OKqL/FHHdWDv4CAOWmXWR+FCG1y89NZ6TRbtBhCiYZgxY3bbOdNATEgeWtDbgPhU8tdBufWpFvqviI5jN06eVcYnI07n8taeD5e9RNIQjmSPxqsq0bUR1200gfQVVsWwWAO0g/hNWu8Qs5EAF2IkcuVFiDE63GA18QAPyH5Vy5cGaBr5+nTyp0EeI/G4J9AZk+pquhboZqsrmOvHwSvwge+szVniqESCZ8YB9BbWD9aqYhoGsn06iKm4gcxMdTz/tFRSwKeJACJF1Y18q52nFxcZfDeIi4QSq+E6DT5RV7s1hs9+0sBiXmCP7TVfi2LyPettczAsRIHxQYny2pPS+LPCbCi3daCSXsx0Goke9DeKSbzg9T9DRThFkNYNzxf49pBrpqJM/rQzHt/Ncz95gfOKfa/SHh0C6GecqhmMa7A7CncME3JAV2yme8YZdthKnbb20rqJKsdgFAP+plX86MdkMj3yqoBlS40nUmFbadqeRMCGQxnyqgJb4ByEAz4wd+YH6VDh7JdlVWzkzGaTrp/VRSxh3awgRGJHeTpG7AjU1Y4Zwx7d1LjlRlk5d9/SR9a3NZuAmVN/wCXoYOlzcego3wjspexEG3bskHn3zGOeqiSp8mAonwLs9hu+t/aJe33hLycq+KRLRrAJB35VXx/Emw2Ku2LUnD967W2QnxIxJQDqFnL7GrlZ2CCdgrSKDiL4Q81zAR5Aw0/IVNiOymEt22ZcThwsROVncny8ZAOm6qI3nnVDG3c2UAeZ/f73p2HQHQ6jzpYSt52a/incuG3Y7i2pjKGa4wXwqSJgMZMR6msd2n7O3jcN3vA+c7WyxiFAEhgIBArZ9guHoZW3lAeA+gOYDUCTqPavQMdwhAhKjUCuW2t4+Z7nA7ktDWhClodwCcv3RoQWPLX5VTPD17oO8SbqpAK+EEEk/1eUxG+tep8d4sLbEZDp0f/AGoBc7SWvvWmPuK3xmpbjFcRwNu3GQEEgaTPvrSuM2dwxkICJ01EA+5EnWtY3HMOd7JPqiH8TThxbBneyB62U1+RrU4fqfL8YrBnxiAdx5b1tcUttHw4c5V70PczAnwZgOYJ2zHY+lTWsVgCZ7tAREHugIj0pceNvFxkuS0ZNQdVnQSRy1rHLhnbU5dY9M4hhuD3LD90bDPlYJlaSWghQASZ1jcV4vcsrnYqvh8ca8tStbfsZ2KU5u9JYsAFCCRsdWO/SPrVntF2PayGMacj5frXPlza4x5XfmdY6VXxC/CN9PxNFeIYVlJHIfuBVDFmWAA10089NK1LsLGj7XX4FgrIOQLHRY+m21ZuxaLKxJ+8ZJ6Ub7UrFxMx2Gy8yBrHoZoFbYsvodB0pPC+p+HH+YseESJPkNflUWOxEwRqDsfxnz0mn4fQgfM03DGNVXMu0Hn++tUrQcawpKYUs0A2dj92IiOs/lQfEMAVGw09/WiXaMNkw7s8i5bJgCAuUwFoGSS8AbRt0qcfFqC9fjUfOnCSo6cz6Uy5Yk6kCpLt5csBToflWmXbK7FYgTpzpYSCCZjX9KWDHxxJBWB5E7RRTgPDg9tiWIhyB4Z5L+tS1ZNBNGJM6x8qe9yB4dPT0pgXaTTbhMgDnWmFu4oyrMyf2aV/4dNTmOvsKdi5AX5eggGlibcKNtzz8hWNbF+xaK+KQOTlA5GCTEACgXFcHmv3coAGdoE8gTH4Ue7MYJLpfOWWFnMDBlQTp6/rQLFqc8iZnfnVnqXwd4VayYe0DpOKUkTyCE0CZM91gPia4w8tTAM/j6Ues35TCpIzC8WI5/DAqrwfBK928xWVBbQ7S8yPlPzFXjNqXqJ8LgbKk2Q4uFoLQQR4DIErpvrAJ2onhcEts+BVUncga/PepLOGRPhUCpUViNFOvM6D6612kjneVOK6b1wWgNacARvE+Rn61ewVkHxMBGwnbzP7860yHvhbpAyXLVtTzcEt7KCJqhxfArbsvda5duuAoAjIgzMq8hm5kxPKi/GmZLSlDF69cREkaAueY/tQH5ChHbHwWhbVmYZgzMxEkDwrsABJLbD7lZpKz54jqvgULO28fOitq+Aw+NRzWNCOY8vaKzF1tvc1qc+tY9bvTVdi+LtZMgz4um8VtOJdvAbZUjKYEyDMESD7gj515LaxRVtDuAfdf+ajPFnCvbkZS+f4RuRyJE89prl/W38hDjvE0ckhhWduXln4h867exE7gfKqrEH7q/KuvGYxanzjqPnXCarkL/SK4baf0/WtsrtsUUwJEiaz6ovQ/OrFkjq3zrNix7b2D4vat6NppvRvtdxu0bWVWBJnX0H/ADXifDeJZORfyLNpHTKwqW5xdmVlJJIEjX3/ACI964Xje46yxT45fzNE8/nQYoXuCJzZtOu4Gk86RxJa4J60/ACb1qGM5xqN9xSTI1exPtTZK4jIQfAgAzEH4vFJyyJk0JUwjcjz8p/Zon2oxLG87GcxUGTvpIH0oBhXJJXfMDp1IBitSbGbcq1wxMzgEwIJJ6Dma5ibk6JIVdAI5efmalVsoZF3iW8yOXoKhW4SImijPHNbeFtlmKhJM8ixBIHl+tCLjEuY0E8ucdaLcfw4Q2lU721c6zBY8v8AtFC7dsAyTrJ1/fOk8L6qi3HlpSvW/wCWBtLE/Tma7dddgD60/E3ItJA5t77aGqyjskBDDEnMvpGtazs/gMQ9rNaHhk8+ek1kWYiyWOhLqDA8prc9mrvd4dR3pAPiAViIB5EddDWeTfH1iGSBJPT0jpSRlnQdNafeRYAkmTy/P60wAczA20rTC5jdIkcgR+FLECTEwJ1020pmNuMTljbQDpzqa63iY+W3nA59N6y0ucHUQxkg5WKEbgj9RIoPiL8SFAk7n9KO8Pwqm07ZjK5DpsJJkGfpQa/bJJ1PlqKs9L4Oi1lGCgGTnZtNdtxVng1rLaBjVpY/6tv/ABy1UvHx4VQQItnUbk8yaLVv+OMc/wDHXGaF/qMH03afYEe4q4zc6q4YSxPQZfcwx+mT61Li2hfXT9f3512c0doF2AHP6daLFdAo2ML7bn6A1V4dbgTzP4f7/pUzqxIIIAE8zOu/LyFGarYi53mOX+nDWyx1/wDVveFRH+QEj1rMdpboCEDmwUeVux/LHzdmIP8AdV3tRjrth7ItuJfOSckxlyeL7x0BYyOQqljEhgrAR3KgBiI8JMrJgE8/OsrOmWcgkAbnT9K1DNrVIWbYKlVT4hsBOugI8wYM9AandtJkDz0P0qSYtunXW1U+cfPT8YqliDDDzBHy1H41xeJXhKSuQ/1WVaSNjqCVPmINcx2wPMQfy296KYWqa2oiqL95yCt6f811MWwgFI/fQihE97emUy3i0O5IPmPzqR9dVAb0IqoQNPtNVT7RBgqR6/8AFPXErI5fvyoCq3dB5fv8Kr97lYeuX9K5ZxCiZ1Hl6R+lQ3XmY3gH3HP6GphKdZtgXJnRSdOu5H0ruAsMb1qCJLjnoDO9Ma5LKeqk+4H/AB8qsdnWt/aLJufCHBIiY0n8q5WY6yiXa6w32i4hiRkXTaAo1+VZnAN4k9NfMzM+Whj2862PafFr393EZYDOAin70KBJHICKyNjDsH1EAGRBHOYEcvSnA5LdsQrHy1PrStJmIjTUAnlrUndllYtMaae9dwag3LYbRcw8O2n751K1FzjOMVrwCiUQKi6zOWefPc1QNsZieQBP7FX+0bL9quZIjSMsQPCNBFDrkEHc6bf70hVDE3OnSauX2As2iT/VA6nrUL25IkARuZ29udP4xBW3poAYA6aVWUd5Js+tzUf6d69Y7L4PCnDW89pWaNSRXlJYC0s6BnI05aDevSMJxtLFtLYZF8MkM2skn/ascvG+PTzkIAfCDtoK5pmEjeI+YirBcjkMvUfSehpyX8hUp8ZgjnlB0O/OtsJsTiUW4xIkloj00ieVR3bmZjGkyNNqbi28Ynddz1561LghuSNgx38xr/tWWhDBYbNZvNr4WXKJgE6CCOfWgDSTG5BO9G+HCbFxzmEMII2Oux/KhXnuOZqxK0eDwTM6MBOW0o5bvqdesD/yoquCJ3IH1puCcLbUkiWAb5gR9IqX7YPWu/CZHHle0tjBgCCzc9jG5J5a/WnLYQfdB9dfxqqeIdF+tR3MU/KB7VpntNi7rM/doxSEzsygSJOVFEggTDmeiec1aw7hUUE7ADU66CJ9azly9Fy6zNAi0CSYGneEf/lVzDXldQykEHmPLepok4y1p7lqRJTM8x0yqFneJbNHVRUN7u2jMqtG0qDHpNR4j/EH+Q/Ur+lROaIH8etAoO5CoZ1IGUwdIDAc9PYEc4NHEWAiIOcamNz1owTQ7iVssQFE+4qVqBVyrvB8UoJVohidxpMDf5fWmJwe6+ihAeWa4qz/AKmIUe5FEsL2F4jlDjCl0n4ku2nG3VbhrO41i6uEw7f+298v6VYtcBtN8P2c+QYT9BQS7wjEIYezcU+a/ntT1s3UIY27ixqDkYD5xFXUwX/+Fp2sgj+1x+TaVVu9kydRbYEc8+o/8qKcK4iLo/uG4H4jy/CrfEOItbQnMdPP5DXzq9M7QG7wEIsuLgEgSXMSSAB7kiuYfsl3wDWkvOpmCi5gYJBghTsQR7VUv9rrp8LqrAEH4RupkHU7g1d4J/ELEYVAlkBVljBVW1YljqxJ3J51LWpDbnYW8uvcYoethvx7sVFa7NYhdGF0KJIzWToWygnUcwqz1yjpWiT+NGNG4Q/6B+VS/wDzrxZ0KWz/AKT+RqKx2O4R3dsmXJWTAXWCCpMTsM0nyFVeyzscQioC2swkZtOhING+P9tlxkG9aAZVuICmYQLoyvoQRMAaxpFErP8AEjQA21MACTmn1J60s1ZcCO06A4gqpJAjW4Sx2BJ8RMak0Na0BEAtHl+VXeNsL7HEIMoJ8aDkx2b0aPmD1qkqRqNB1/SudmNy6daRsrM2skaHb5dKfwKx3mJt6BiWG+2nUdKZdM2pPNo8tBVvsZaP2y3BYanbSZG1ZvjU9R8esMMVeBgEMdtBoBsPah4QanUzRTjCTib0zpcfcydzzqIALJgfvnViAfEHghdZgE/WBVriVyBhzH/pzt5zTuIMhacsHr5UzizStkSRFrpvPPSqhuXMlknTNeOnyrZ8TxTIyqqW1GUH+YIZpk5tjoZ+lZXh9sRYBMQ7MNJmN/Tai/8AEPEW1xFv+Y5mxbJg9c0actI0rP2u9Ati6VaR5SOvkRUuYf0ga6abelNe8GMsg9U0P6U8KBBhjzEnQ/LaqGFAx9+tXLKKRc1kwY089KoofENNz1qWy3heOcbes0B7Drl4a8jxd6v7NAxaA8LAgHUxRE3G+zKpjIziROpP+351TxGYHQwBOvSORpCjWHuB0DL6ehGn+/oRUoFB8Fie7DTtExzJkDQe+vz5VPxK7etot024RxI15AhTr6snL71dtcvjRKKY1wbUCt8UbIXuEASANTM7nTnp5VJhu0LsMqOdI8LTlj/KdDrFNT4rnFLOW5aVo/nKGKHWUBco4HIyGHmDPQ0RsWgoAUQBsANKDPgLgvWr9wgm4W1CgAhUGWAgCgARGgo2gqxKp4x8rydsn/7H9KGXMRnOVWEzrBB0O3psdfTpQTtFjWuXWE+EQIB0kAa+fvTOzt7LeUf1afgfyj3rNvbUmQT7QI1u6oDEKyKQB1iGPuwNV7XERaWGzszQ0TpGoXU6jmdBzFaziXB7d42y95CVUg5cx3OYQQADufvchWRucN7x2Kg9AB/SvhH0ApYsp6doP7SvpB/ECrOG4oSZS8wJ00cg/ka7h+xOIcZlXwnnp5zJnTY79KpYrs1dQEkSBudYHkTGhptMGbWMusfFfuxp99jzEwMw5SdxtuN61GK4fhxgEvjGu2JLAGyXkATB8MZxA1zTB2jUR5rewFy2J8S+hMfMaU0Y+6v3z6afpNS0x6u/Ze0cRYtLdZe8crnd7TllAGW7bNuMqvLKFYkzl1OtB/4g8EGEvd0t83V3AZtfMRMZhygdRpOmHscbuKdl9tKvX8UbuVm12O/SImRSFCcQmU9QdQeoqMmid4Akk+FZJAMQsnYEyefM0zC4e2zlWuoixIJWVB0GySZ06chVwDZpTRn/AKbbIci9alSQqlHm4B94EaAGdAxB0O2kpuDD+XF2we8ifjHdzl0uEmBE8p+E1MAgNThRX/opzFc9jTLr3kKcwJ8JLeKIgxsSBVbD4fYwuh5kjbTp5UsBzgGGclUUBmfwlCNGB3EAgztGu8dK2mP7Gm2wR8FJK5hGIIECJly4RYmNecdRWK4VxIoy3FYBwZ01gCCIPMzO4/21XHP4jPdZS4QwpUo1uVIJnVT6KfVRUogxfCrXdOXwGJW3acq7Lc0R5AIJPOYHPcdaB4TF4azcW5b+1DL1Fon5hl/CrV/+IGIOHuYfvJS6xZvCATmMsAY0UkbD02qnw/g17ElQCJYCM2pAOuvz6+VOs7OzHuLcd7gJglmAO+p56n8akt4SQTU9vhHdkgnMQSNoHTbX8avIkeGJ9o60xdZzHYUfd31qrxZJFrXUW4HpNaC9aUTp8/WhvE7JOUDkN/yFMVBwlR32FB5BifQk713t8ufGP4WAVVUTpoBoY6a1c4LYH2mwSSISSYnSd460M7X44vjL7Fdc0a8oUD8qxx9aviNzHodjUi3GAg/7eRp12wPIx5+fSoiDVqQ+xEjT/au2/hPWRUdlfF0q4lrwk+Y/OoqzfT+VbBA1nUeWmvnQ3F4gqYVdT947ab+p/WiGI0yDy5UxsRbFtgwVp0AI5nXoY561eKcgazxFxEnTSdNwdx7Ca9X4pw77Tw1AiF2AB8K5jJ0IgcwxV4n/ANOvJMRbzHRQumyyBpqTqelGuB9qL2Ha3Ki6ijLkZ2A6TOoB84rowg4pwzu3Ft9DbUZpIEM8sQfMaCPKoOE21W5PeAMNMpmWEqZUxB2PP7vpT+PcU7+/duAQrMYAMgDbQwCefIb7aChdp8roeQI18pk/Sag9g41w5fs9u4ACwcAn1VgfrA/4oRct5UZzsqlvkJrUWz3vDn3lQG1BH+GQzR1+EgdayHaTiaDBXEVpZ8qaDkxlveFatRmzt5qQXM82JOp6kk6miXCuGB2UBrguT923mA1UKZDTM5iZAAC7yYpYGwImJMSD/TGs/IT7US4ExW6CFzkiADcKlpMkSpB1hlgEfFuDFZkaErvCcpJV7xGoALEnQkagQQwIgqV58tqX2kWwIyx6aN/aeYnXnWpv2fDlZZI0ZTMjNDB1adeuhnlrWP4zbhgs6EZtdNy6/Pw1obvsstu4Sq3rbyR3iG24Cp4Q724BuNBKqpbKBLdZo3fwbFlZWyLbVTDW2YlGMSCo55WPuNRQjsIlx7feIi3bucd4W8Lg3HAchm0YZArjQeJGHKiWLuXheFi29y9atzbZRne6hgkNduzGuUJtOxk6miMr2vwllbSXS4+Eu6m2SGzd2EyjKMklwfERvqRtXmGLRc5AeRHxFSJgaDKNQToPXUmNa9g7RXcNiFe/h1vPdUjM7ARbFtbma5nYMGVoC5T/AGDyryfi7EkEsGkljCgGX1aSACdfYRppUsUMohw69oV6behoc+9PsvlYGpFGHAIg7HShVzCOCRlJHUDfzooKU1rGQc4Zv6D8q53R/pPyo9wzAPeXEXDfFpLOXVlJU53yRIBI+R3pYvBOgJ+24doBOWWDGOQU2xrpWelAdR1Hzq9w1GJzEmBync/vX5daI8Qw1yxfvWHcObTAZlmDInnrUQNWQ1MLnnVHBfzWc5blx/uoikmD94gDYaDU/eHt3iF3Kkczp+v786fgMabV5rv8ovbKhIHhzK2jKLeUFQFMk6EEA71KRpuE8CskrabEJ39wA5SzAW0bIwzALuysIgmOnS/iMauCuBUeLy/EjEBYVEdVUBD8YPxFtZEeRfsRwNWsJiLjK+dZW69yDauOy2mWJOddHOpBLIFOUwRV421r7KbbXLbZAqriMwutMB+6DIdVFwMgJlVBMfCTVwcwGLW/LLEg+LSN9dpO45SeepiaM4XATuB8qxnYXEn7X3UqwbNqBALLBDaR4coYD1r1PD4TSen1qwZHH8K8vKaA8S4aygGJ05V6bieHgrrQa/wdmPPLSw1iOCYf+dbManKsTyzCRPLnrWb4xezX7rZd7jnafvHnXoeI4IUulp8IBiCZUjWfWsDicHLEiddTpzO9cpMre9LiiwxE5rR6jxAeoOtWL/Bi0d1dtNoTGbKfk1OxXB7udgUYwJnKQPb98qVvhF0q1xlygAkE84GwG/KgjXg14QDbMnaCDPymreLwRs6FWLbmVMCJ1qthg5y5AQ3xfKiz8Yv2yQLrZdtTMfPltSFACSxGb6nSKl4bw9r1wE6IpCArAJMNc7sTuYDE+2u1HsFiLeLZUvWhM6vbEHKozNMb6BqsjBqqLfuAQom3bAO+zsxPxOf5ZncATsStanTNZXjnCgpdrZEguWQsc0BsuYTus6zOsigTCdj8/wAfLrW7scQF1u7NtELDJbdBBBkFUPVSyqI6xymgHBuHquIUnxKt1EA08feSApB8pJHSegB1qDeG7IWThBc1NxlDqFHiKEKRuYDN4yORGTUSYweOw5R3tsIKsynTYqSDp7V6D2hfI5VPCtuEQCdAgCgjXymekdKznaqwbjfaQp8du0zkbB/8JzEfedTz3nflmVRq52zuW8Ktiyk3HtrndtQveKGIUcz4o10HnWbvYl3spm8UO2/MhVjb/M3zo3huFrdsW3Fttbdpc+ViuYW1EHKNARlEf2nrUq8Nazb7p4V9WggSysMpidvhOo9qqCHEOzqpwi1eAh0ZA5/qW4YI9Q5XflpQvs7wtR42VpklY6wYP/dE+Qr0XtDhwMDYsDaM22syp5nahYwspCjKq9P1+takTTCBcVW8cfCYfVRBUEkbAzl9xyNZLtevitAc7C6+ee8ZHuTW4w9gKCw0LaeWh+lZTtdZCmwP/p1+ea4fzpSCXYvtEy4lJw1pQ9pk8AZMwDO2YSYaPEusxlPQir3BbxtXGLr/AD7ue26F2KhUuFwjID42hCRczABL5XYA1lOF4YPem7c/lWgucqd1kDKuoOskfPfn6BibSX8gt27uXuibVxMoY2z/ACoDMk5z3swSNDrtqUCscOVbjzbVkRFsoC+bNmB1ZssG4Vl9tM0xtPnPGLIDtlUgSYBMkRyLQJOm8e1eoXeItbsC86Zrt3urlvSCoz4gBNpYZchgciupjXD8UF25cY3wykEDKywyLAKjKYIEMCAY3PU0Rkmw8nST6dZ/CJ+lQlSJBHvz51r8Fw3wsR9eQGv5UrnBg9kP94bx+NTF1nMNihABMEVY7wdR86gxWAgnlXMPbK6yQVE6NBnYEdd505ChixhMXes953N7J3kZgAJMEsNTqIJ5VquM8YDYHIt6znbuwotzmyMjG8t62+YKQx0ZTJ8xrWNDaRy3jlO21Itv57/jTEW8Ribl27cvXSpe4QTAgSBG1czVQvvB/wAunLTcnUb6kx7VXdpAnl+f7NNXEuNvZm8hp+v78qO9kbFp7qrdZrLIty4jqpYsVUXBnWdVCqxhYLBoHI1mwKNYHOnhNzItw927AZnVUyyYHiyw0QpGYKw5RUV6hhLtvE3nud9gzYX/AAhL2/DLvc7xWMKwUqS0CfMAmhi8Rw2Jwxtsuqy9lEnPeti4wVQmhzDxQgMHPJGmlnhuDS1Zt4MPhMR48+YMouAXBaNtjburqLhuvbOo/llOpBb2h7Mq7C9YQhssWgkKlo51IgpoWBd2JYzrGpIqowvZm81vF2JEEXLYO4OrAGQfIkfua96wqSNa8FweGfvkuFpIYExoQUMAEcttq+gks66fuK1EqVUBUaVXu2TyE1eFo0hhiJ6VUZXE2G1kba7dfyrJY7hyZzlBA5fWvUbmEjlv9azmK4WA2w95/Ks2Lrarw5Old/6an9I+VXKU+tMVQ/6Ta/oWesCo34FYaZtoZ6qKJio3edqYMN/EPALYwq90MrO+XwAZiuRyfPLIUGP6qxF+2FsWkVg6wfENjJkEezVuv4m2M9myCuYd8JboCrAjTXWZ0/orJYfCr9mtRyWCfOdflt7VKMrjEK6rupkeRGoongEQ48WsmhxLFddslpiJga8yNRq3kZuXcEGMdTr6c/pVPCX8uMDmABirRJ6d5au2mOpiJWSfM76ATFX+01jNcaNsx+mlZPjdtcqKQSe7GWCYUi9dMkTB8JYCRpmmRz9A41g4mOR6VmOIYUtdCcgFHlIAJ+pNTiUD4ZjMSltURyqA7Ab84M8t61vBMLdvQ9wJBIBAQAx67kxr61Y4VwBWKg7RtHvWjs4KFMcvLzn9a3jIhxvCHKk6kW1B0jxaTpyqhcswkDpoOZYn9K0GJUui/P6VUs4fw6j099DVgErhPBB1gSGjry+U/Os52uwJbumiYsoPq9b8Ybwkf8+lZ/i+FPhMeHuwPfM36igxvCuGoxUqQWV7M22mbma4QQoUSVCgFuetarFv9mtYe2j3FNvvA0kZ1IFy5k8JIkKpTpoNqpcN4czO7hDJB8SsFyHMDKGDB8JAjbXyrV2iGctqHuDNDKNCDJcgmCYEfXcVFBu0XCVxB71WzEkKwzTkjPnBaeTCIjl1oXxHg9ozkJuaCWIMluZ11PvRxrVtVGGRFuKi95mQshm6SdYAz7GT5D0FNbfIKwKtGpkknr+nKiB+F4QETaZH4iKiGAgMAsAkacgD+/pR8WWliSdASddPbltUNx457CT+X0oMN2g4W6yM2YN4o00ykATGv3qyWNEGDp+usfvzrVcZYi4zE85/SsnxC+2YxH0qKrFz+Ww/Ty3phciPLy99evvUVy6wOuh9BTTdbr+/apov93ctiSCDPhIUNJ0B8XofPVSNDtFYshhoryfTLprppT+HcWxFsZLd51UmcoOnrB0rSYVLjqHkA7HKoAgcyBpJorMW7GvnNGeESl1Lil1KAkEROfKQIkEbnnyB56URxXBwRmXViTKxyHOrvZ3AFrtq0y5XnOPDMyodJ/tgA+jnrVgLdl8G6I2IvFGXEK1oi46iCgmw4J1nPbW0FG2cHYCO4Rzh7j2mZbdxs/fMfGtvPcTIy22YnONIBBYAqTuSJO0Ns4jEBFUpazq1zKQCM+UM/i8rcgHYKT1NA0w9q4uRj41csbjHW4jNZtIkGCSPGS39u3iJqopcNwwF4raYukwGgglesda+gzZEn1NeT8A4cFdcoEhshIB111YyTHIaRsOe/rCmrGaeq08CuCnVUceyG3pjYQH7xqda6Vop/eeX1rofy+tODeldBqBhJ/ZrmUxE1KDXdKKCdoOB/arS2zcKZXDggTqARBB8mNC7fYuFK9/ImR/L21JP3ta2GldoMTb7DRJ7/X/7e3/nQt/4YsXLfal1A07g7qcwb/E8yPQnrXpWn7FdAFQZXEdlmYGLqgkaHJMab/F1oVh/4fFWDG8pidBbPP8A1GvQIFKBQZvD9m8pkMPlU54HpGYfKj0CllqoFf8ATDljMPWuW+GkCNDG1FstLKKAUeHmfhERr4qqvwpoHgDQR94DQa/OYo/kpZKisthuCulw5bahIUzmBlp8Qg6j1qDiPAb7vKlQum5loIIZegEwR9a1+SlkoazmF4Oy5SVXOEKSIiDyHOPWqx4NcBWEBGsyV3JGo9pFavJS7uhrI4jhd7KwCanTcbfPpQ2/2evySEmdNSNoAk66e2ugrf8Ad13uqGvFeNdisa85LI5/fHlEyfX51k7v8O+JgmMI531Fy3t/319K93S7qmGvl69/Dnikk/Y7nL71udv89Qn+HfFP/Z3Pmv8A/VfU/dUu686mGvmbhfYXHqfHg7u/Qfka1eA7N4qGDYe6uhPwHU17d3dI2/OmGvIbXZjE57R7q4U2aVIIBzawRECRp670+z2MxBOdVNs/DBXMRIKM2ZhzBMRBE+9et5DSymrhrz692Vcqpy5mhleV+INvoFA2EAiMoMCq2F7JXbTM4tqzAfylymLYJfwhgIkZiZK7nfWvSsppAGrhrBcN4C1u4oNtyLayWyse8d+e06Aa67sT5VpLKMPut/2mjOWu5TRA0T0PyrubyNEYpRRFANTwauRXIoqARXRSpUV2u0qVEdpUqVB2u6UqVAhTqVKg6BSilSqDsUopUqBRSpUqBUqVKqFSpUqBRSrlKoFSpUqBV2a5SoOzSmlSoFSrlKg7XZpUqBUppUqDtKlSopUq5SoP/9k=',
  '/rent/fiat-esprit',
  '{
    "version": "Esprit Shaman",
    "electric": false,
    "color": "Mystic Purple",
    "theme": "magical",
    "horsepower": 350,
    "torque": "300Nm",
    "acceleration": "7.0s 0-60mph",
    "topSpeed": "140mph"
  }'::jsonb
),
(
  'zaz-neon',
  'ZAZ',
  'Neon Dream',
  '"Яркий салон" + "громкая музыка" = Дискотека на колёсах! Салон в неоновых трубках, встроенный диджейский пульт и стробоскопы. Двигатель 1.2L, но с RGB-подсветкой! Предупреждение: может вызывать спонтанные танцы на светофорах.',
  199,
  'data:image/jpeg;base64,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',
  '/rent/zaz-neon',
  '{
    "version": "Neon Dream",
    "electric": false,
    "color": "Neon Pink",
    "theme": "disco",
    "horsepower": 80,
    "torque": "90Nm",
    "acceleration": "15s 0-60mph",
    "topSpeed": "100mph"
  }'::jsonb
),
(
  'volga-vampire',
  'GAZ',
  'Volga Vampire Edition',
  'Для "тёмного салона" + "механики". Кожаные сиденья с шипами, руль-летучая мышь и встроенный гроб вместо багажника. Ночной режим вождения включает трансформацию в летучую мышь (по субъективным ощущениям).',
  888,
  'data:image/jpeg;base64,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',
  '/rent/volga-vampire',
  '{
    "version": "Vampire Edition",
    "electric": false,
    "color": "Blood Red",
    "theme": "gothic",
    "horsepower": 150,
    "torque": "200Nm",
    "acceleration": "12s 0-60mph",
    "topSpeed": "95mph"
  }'::jsonb
);

