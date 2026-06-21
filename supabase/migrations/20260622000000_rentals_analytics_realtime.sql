-- Enable Realtime for rentals-analytics real-time updates
-- Allows crew members to see checklist and todo changes instantly

ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_todos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_state;
