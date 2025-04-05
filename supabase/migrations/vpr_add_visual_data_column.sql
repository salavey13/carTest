ALTER TABLE public.vpr_questions
ADD COLUMN visual_data JSONB NULL;

COMMENT ON COLUMN public.vpr_questions.visual_data IS 'JSONB data specifying the type and parameters for visual components like charts, axes, etc.';

-- Optional: Add an index if you anticipate querying based on visual_data content often (unlikely needed now)
-- CREATE INDEX idx_vpr_questions_visual_data ON public.vpr_questions USING GIN (visual_data);