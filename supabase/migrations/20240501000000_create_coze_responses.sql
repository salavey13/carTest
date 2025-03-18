-- supabase/migrations/20240501000000_create_coze_responses.sql
CREATE TABLE coze_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  response JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
