-- Enable Realtime for rentals-analytics real-time updates
-- crew_todos table should already exist from 20260621000000_crew_todos.sql

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_state;
