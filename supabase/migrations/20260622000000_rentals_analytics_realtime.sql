-- Enable Realtime for rentals-analytics real-time updates
-- Also creates crew_todos table if it doesn't exist (in case migration wasn't applied)

-- First, create crew_todos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.crew_todos (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL,
  assigned_to TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.crew_todos ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists, then create it
DROP POLICY IF EXISTS "Allow all on crew_todos" ON public.crew_todos;
CREATE POLICY "Allow all on crew_todos" ON public.crew_todos
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS crew_todos_crew_id_idx ON public.crew_todos(crew_id);
CREATE INDEX IF NOT EXISTS crew_todos_assigned_to_idx ON public.crew_todos(assigned_to);
CREATE INDEX IF NOT EXISTS crew_todos_status_idx ON public.crew_todos(status);
CREATE INDEX IF NOT EXISTS crew_todos_category_idx ON public.crew_todos(category);
CREATE INDEX IF NOT EXISTS crew_todos_due_date_idx ON public.crew_todos(due_date);

-- Create/update timestamp trigger function
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

-- Create trigger if not exists
DROP TRIGGER IF EXISTS crew_todos_updated_at ON public.crew_todos;
CREATE TRIGGER crew_todos_updated_at
  BEFORE UPDATE ON public.crew_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crew_todos_updated_at();

-- Now enable realtime for both tables
-- Note: These will fail silently if tables are already in the publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_state;

-- Comments for documentation
COMMENT ON TABLE public.crew_todos IS 'Stores todos/tasks for crew members with real-time sync';
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
