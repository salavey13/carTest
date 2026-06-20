-- Checklist state persistence for VIP Bike dashboard
-- Stores the current checked/unchecked state of checklist items

CREATE TABLE IF NOT EXISTS public.checklist_state (
  type TEXT PRIMARY KEY, -- 'handout' or 'return'
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {id, text, checked}
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (but allow public read/write for dashboard simplicity)
ALTER TABLE public.checklist_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on checklist_state" ON public.checklist_state
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes
CREATE INDEX IF NOT EXISTS checklist_state_type_idx ON public.checklist_state(type);

-- Add comments
COMMENT ON TABLE public.checklist_state IS 'Stores checklist state for VIP Bike dashboard (Выдача/Возврат)';
COMMENT ON COLUMN public.checklist_state.type IS 'Checklist type: handout or return';
COMMENT ON COLUMN public.checklist_state.items IS 'JSON array of checklist items with checked state';
COMMENT ON COLUMN public.checklist_state.updated_at IS 'Last update timestamp';
