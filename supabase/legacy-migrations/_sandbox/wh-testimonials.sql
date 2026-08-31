-- Добавьте в Supabase SQL Editor
CREATE TABLE IF NOT EXISTS testimonials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_approved BOOLEAN DEFAULT false
);
CREATE INDEX idx_testimonials_user_id ON testimonials(user_id);
CREATE INDEX idx_testimonials_created_at ON testimonials(created_at DESC);