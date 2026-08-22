-- Crew todos persistence for VIP Bike dashboard
-- Stores tasks for crew members with status tracking

CREATE TABLE IF NOT EXISTS public.crew_todos (
  id TEXT PRIMARY KEY, -- UUID
  crew_id TEXT NOT NULL, -- Reference to crews table
  assigned_to TEXT REFERENCES users(user_id) ON DELETE SET NULL, -- Assigned crew member (nullable)
  title TEXT NOT NULL, -- Task title
  description TEXT, -- Optional detailed description
  category TEXT NOT NULL DEFAULT 'general', -- Task category for grouping
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'done'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  due_date TIMESTAMPTZ, -- Optional due date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES users(user_id) ON DELETE SET NULL, -- Who created the todo
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ -- When marked as done
);

-- Enable RLS
ALTER TABLE public.crew_todos ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all for now (dashboard simplicity)
-- TODO: Restrict to crew members only in production
CREATE POLICY "Allow all on crew_todos" ON public.crew_todos
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS crew_todos_crew_id_idx ON public.crew_todos(crew_id);
CREATE INDEX IF NOT EXISTS crew_todos_assigned_to_idx ON public.crew_todos(assigned_to);
CREATE INDEX IF NOT EXISTS crew_todos_status_idx ON public.crew_todos(status);
CREATE INDEX IF NOT EXISTS crew_todos_category_idx ON public.crew_todos(category);
CREATE INDEX IF NOT EXISTS crew_todos_due_date_idx ON public.crew_todos(due_date);

-- Add comments
COMMENT ON TABLE public.crew_todos IS 'Stores todos/tasks for crew members';
COMMENT ON COLUMN public.crew_todos.id IS 'Unique identifier (UUID)';
COMMENT ON COLUMN public.crew_todos.crew_id IS 'Reference to the crew this todo belongs to';
COMMENT ON COLUMN public.crew_todos.assigned_to IS 'User ID of the crew member assigned to this todo';
COMMENT ON COLUMN public.crew_todos.title IS 'Brief task title';
COMMENT ON COLUMN public.crew_todos.description IS 'Detailed task description';
COMMENT ON COLUMN public.crew_todos.category IS 'Category for grouping (e.g., maintenance, orders, documents)';
COMMENT ON COLUMN public.crew_todos.status IS 'Task status: pending, in_progress, done';
COMMENT ON COLUMN public.crew_todos.priority IS 'Task priority: low, medium, high';
COMMENT ON COLUMN public.crew_todos.due_date IS 'Optional due date for the task';
COMMENT ON COLUMN public.crew_todos.created_at IS 'When the todo was created';
COMMENT ON COLUMN public.crew_todos.created_by IS 'User ID of who created this todo';
COMMENT ON COLUMN public.crew_todos.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN public.crew_todos.completed_at IS 'When the todo was marked as done';

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_crew_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER crew_todos_updated_at
  BEFORE UPDATE ON public.crew_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crew_todos_updated_at();
