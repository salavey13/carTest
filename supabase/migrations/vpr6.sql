-- 1. Create Subjects Table
CREATE TABLE public.subjects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Русский язык', 'Математика'
    description TEXT,          -- Optional: General info about VPR for this subject
    created_at TIMESTAMPTZ DEFAULT now()
    grade_level INTEGER NOT NULL DEFAULT 6;
);

-- 2. Create VPR Questions Table
-- Renaming from 'questions' to avoid conflict if you keep the old one
CREATE TABLE public.vpr_questions (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,         -- The question itself
    explanation TEXT,           -- Explanation of the correct answer
    visual_data JSONB NULL,     -- JSONB data specifying the type and parameters for visual components like chart, axis, compare, plot.
    position INT NOT NULL,      -- Order of question within the subject test
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (subject_id, position) -- Ensure unique positioning within a subject
);

-- Optional: Add an index if you anticipate querying based on visual_data content often (unlikely needed now)
-- CREATE INDEX idx_vpr_questions_visual_data ON public.vpr_questions USING GIN (visual_data);

-- 3. Create VPR Answers Table
-- Renaming from 'answers'
CREATE TABLE public.vpr_answers (
    id SERIAL PRIMARY KEY,
    question_id INT REFERENCES public.vpr_questions(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,         -- The answer option text
    is_correct BOOLEAN NOT NULL DEFAULT false, -- Indicates if this is the right answer
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create Test Attempts Table (Track user progress per subject test)
CREATE TABLE public.vpr_test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Use UUID for attempts
    user_id TEXT REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
    subject_id INT REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ, -- NULL until finished
    score INT,               -- Number of correct answers
    total_questions INT,     -- Total questions in the test when started
    last_question_index INT DEFAULT 0, -- To track resume position
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create Attempt Answers Table (Track specific answers given by user in an attempt)
CREATE TABLE public.vpr_attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id UUID REFERENCES public.vpr_test_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id INT REFERENCES public.vpr_questions(id) ON DELETE CASCADE NOT NULL,
    selected_answer_id INT REFERENCES public.vpr_answers(id) ON DELETE SET NULL, -- Store which answer user picked
    was_correct BOOLEAN NOT NULL, -- Was the selected answer correct?
    answered_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (attempt_id, question_id) -- User answers each question once per attempt
);

-- Optional: Add a trigger to update 'updated_at' on vpr_test_attempts
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vpr_test_attempts_modtime
BEFORE UPDATE ON public.vpr_test_attempts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Add variant_number to vpr_questions
ALTER TABLE public.vpr_questions
ADD COLUMN variant_number INT NOT NULL DEFAULT 1;

-- Add variant_number to vpr_test_attempts
ALTER TABLE public.vpr_test_attempts
ADD COLUMN variant_number INT NOT NULL DEFAULT 1;

-- Drop old unique constraint on questions if it exists without variant
-- Find the constraint name first (it might vary) if needed:
-- SELECT constraint_name
-- FROM information_schema.table_constraints
-- WHERE table_name = 'vpr_questions' AND constraint_type = 'UNIQUE';

ALTER TABLE public.vpr_questions DROP CONSTRAINT vpr_questions_subject_id_position_key;
BEGIN;

ALTER TABLE public.subjects
DROP CONSTRAINT subjects_name_key;

ALTER TABLE public.subjects
ADD CONSTRAINT subjects_name_grade_level_key UNIQUE (name, grade_level);

COMMIT;
-- Add new unique constraint including variant_number for questions
ALTER TABLE public.vpr_questions
ADD CONSTRAINT vpr_questions_subject_variant_position_key UNIQUE (subject_id, variant_number, position);

-- Drop old unique constraint on attempts if it exists without variant (similar process)
-- Example: ALTER TABLE public.vpr_test_attempts DROP CONSTRAINT vpr_test_attempts_user_id_subject_id_completed_at_idx; -- Might need adjusting

-- Add new unique constraint for attempts (one active attempt per user/subject/variant)
-- Using a partial index for the uniqueness check on active attempts
DROP INDEX IF EXISTS unique_active_attempt_per_user_subject_variant; -- Drop if exists
CREATE UNIQUE INDEX unique_active_attempt_per_user_subject_variant
ON public.vpr_test_attempts (user_id, subject_id, variant_number)
WHERE (completed_at IS NULL);

-- Optional: Index for faster lookup of attempts
CREATE INDEX IF NOT EXISTS idx_vpr_test_attempts_user_subject_variant
ON public.vpr_test_attempts (user_id, subject_id, variant_number);
