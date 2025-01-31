-- Drop existing tables in correct order to handle dependencies
DROP TABLE IF EXISTS user_results;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS cars CASCADE;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS search_cars CASCADE;
DROP FUNCTION IF EXISTS similar_cars CASCADE;
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create users table
CREATE TABLE public.users (
    user_id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    website TEXT,
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

-- Create cars table (id changed from UUID to TEXT)
CREATE TABLE public.cars (
    id TEXT PRIMARY KEY,  -- Changed from UUID to TEXT
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    description TEXT NOT NULL,
    embedding VECTOR(384),
    daily_price NUMERIC NOT NULL,
    image_url TEXT NOT NULL,
    rent_link TEXT NOT NULL,
    is_test_result BOOLEAN DEFAULT FALSE
);

-- Create answers table
CREATE TABLE public.answers (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES public.questions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    result TEXT REFERENCES public.cars(id) ON DELETE SET NULL  -- Updated to match TEXT type
);

-- Create user_results table
CREATE TABLE public.user_results (
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE,
    car_id TEXT REFERENCES public.cars(id) ON DELETE CASCADE,  -- Updated to match TEXT type
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX ON cars USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON users USING gin (username gin_trgm_ops);

-- Row-Level Security (RLS) Policies
ALTER TABLE cars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON cars 
    FOR SELECT USING (true);

-- Create search function for cars
CREATE OR REPLACE FUNCTION search_cars(query_embedding VECTOR(384), match_count INT)
RETURNS TABLE (id TEXT, make TEXT, model TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.make,
        c.model,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM cars c
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Create function for similar cars
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

