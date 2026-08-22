-- Добавьте в Supabase SQL Editor
CREATE TABLE IF NOT EXISTS audit_progress (
  user_id TEXT PRIMARY KEY,
  current_step INTEGER,
  answers_snapshot JSONB,
  estimated_completion TEXT,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  answers JSONB NOT NULL,
  calculation JSONB NOT NULL,
  total_losses INTEGER,
  efficiency INTEGER,
  recommendations JSONB,
  roadmap JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_reports_user_id ON audit_reports(user_id);
CREATE INDEX idx_audit_reports_created_at ON audit_reports(created_at DESC);