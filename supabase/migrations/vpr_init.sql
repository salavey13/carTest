-- Drop existing objects (optional, but useful for development/testing)
DROP TRIGGER IF EXISTS update_vpr_test_attempts_modtime ON public.vpr_test_attempts;
DROP FUNCTION IF EXISTS public.update_modified_column();
DROP TABLE IF EXISTS public.vpr_attempt_answers CASCADE;
DROP TABLE IF EXISTS public.vpr_test_attempts CASCADE;
DROP TABLE IF EXISTS public.vpr_answers CASCADE;
DROP TABLE IF EXISTS public.vpr_questions CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
-- NOTE: Assuming a 'public.users' table exists with a 'user_id' primary key.
-- Example:
-- CREATE TABLE IF NOT EXISTS public.users (
--     user_id TEXT PRIMARY KEY, -- Or UUID, INT etc. depending on your system
--     -- other user columns...
--     created_at TIMESTAMPTZ DEFAULT now()
-- );

-- 1. Create Subjects Table
-- Stores information about the subjects available for VPR tests.
CREATE TABLE public.subjects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,                     -- e.g., 'Русский язык', 'Математика'
    grade_level INTEGER NOT NULL DEFAULT 6, -- The grade level this subject test is for
    description TEXT,                       -- Optional: General info about VPR for this subject
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Ensures a subject name is unique *for a specific grade level*
    CONSTRAINT subjects_name_grade_level_key UNIQUE (name, grade_level)
);

-- 2. Create VPR Questions Table
-- Stores individual questions for each subject, variant, and position.
CREATE TABLE public.vpr_questions (
    id SERIAL PRIMARY KEY,
    subject_id INT NOT NULL,
    variant_number INT NOT NULL DEFAULT 1, -- Allows for multiple variants of a test for the same subject/grade
    position INT NOT NULL,                 -- Order of question within the specific subject/variant test
    text TEXT NOT NULL,                    -- The question text itself
    explanation TEXT,                      -- Explanation of the correct answer (optional)
    visual_data JSONB NULL,                -- JSONB for structured visual component data (e.g., chart parameters)
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Foreign key to subjects table
    CONSTRAINT fk_subject
        FOREIGN KEY(subject_id)
        REFERENCES public.subjects(id)
        ON DELETE CASCADE,

    -- Ensures unique positioning of questions within a specific subject and variant
    CONSTRAINT vpr_questions_subject_variant_position_key UNIQUE (subject_id, variant_number, position)
);

-- Optional: Index for querying visual_data if needed frequently (usually not required initially)
-- CREATE INDEX IF NOT EXISTS idx_vpr_questions_visual_data ON public.vpr_questions USING GIN (visual_data);

-- 3. Create VPR Answers Table
-- Stores the possible answer options for each VPR question.
CREATE TABLE public.vpr_answers (
    id SERIAL PRIMARY KEY,
    question_id INT NOT NULL,
    text TEXT NOT NULL,                         -- The answer option text
    is_correct BOOLEAN NOT NULL DEFAULT false,  -- Indicates if this is the correct answer
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Foreign key to questions table
    CONSTRAINT fk_question
        FOREIGN KEY(question_id)
        REFERENCES public.vpr_questions(id)
        ON DELETE CASCADE
);

-- 4. Create Test Attempts Table
-- Tracks user progress through a specific variant of a subject test.
CREATE TABLE public.vpr_test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Use UUID for attempts, less predictable
    user_id TEXT NOT NULL,                      -- References the user taking the test
    subject_id INT NOT NULL,                    -- References the subject of the test
    variant_number INT NOT NULL DEFAULT 1,      -- References the specific variant being attempted
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,                   -- NULL until the test is finished
    score INT,                                  -- Number of correct answers (calculated upon completion)
    total_questions INT,                        -- Total questions in the test *at the time it was started*
    last_question_index INT DEFAULT 0,          -- Tracks the zero-based index of the last question viewed/answered (for resuming)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),       -- Tracks the last modification time (e.g., answering a question)

    -- Foreign key to users table (adjust type of user_id if needed)
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES public.users(user_id) -- Make sure public.users table exists!
        ON DELETE CASCADE,

    -- Foreign key to subjects table
    CONSTRAINT fk_subject
        FOREIGN KEY(subject_id)
        REFERENCES public.subjects(id)
        ON DELETE CASCADE

    -- Note: The unique constraint for active attempts is handled by a partial unique index below.
);

-- Index for faster lookup of attempts by user/subject/variant
CREATE INDEX IF NOT EXISTS idx_vpr_test_attempts_user_subject_variant
ON public.vpr_test_attempts (user_id, subject_id, variant_number);

-- Ensures a user can only have *one* active (not completed) attempt
-- for a specific subject and variant at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_attempt_per_user_subject_variant
ON public.vpr_test_attempts (user_id, subject_id, variant_number)
WHERE (completed_at IS NULL);


-- 5. Create Attempt Answers Table
-- Records the specific answer chosen by a user for a question during a test attempt.
CREATE TABLE public.vpr_attempt_answers (
    id SERIAL PRIMARY KEY,
    attempt_id UUID NOT NULL,
    question_id INT NOT NULL,
    selected_answer_id INT NULL,                -- The ID of the vpr_answers option the user selected (NULL if skipped?)
    was_correct BOOLEAN NOT NULL,               -- Denormalized: Was the selected answer correct at the time of answering?
    answered_at TIMESTAMPTZ DEFAULT now(),

    -- Foreign key to test attempts table
    CONSTRAINT fk_attempt
        FOREIGN KEY(attempt_id)
        REFERENCES public.vpr_test_attempts(id)
        ON DELETE CASCADE,

    -- Foreign key to questions table
    CONSTRAINT fk_question
        FOREIGN KEY(question_id)
        REFERENCES public.vpr_questions(id)
        ON DELETE CASCADE,

    -- Foreign key to answers table (allow setting NULL if an answer is deleted, though cascade on question might handle this)
    CONSTRAINT fk_selected_answer
        FOREIGN KEY(selected_answer_id)
        REFERENCES public.vpr_answers(id)
        ON DELETE SET NULL,

    -- Ensures a user answers each question only once per attempt
    CONSTRAINT vpr_attempt_answers_attempt_question_key UNIQUE (attempt_id, question_id)
);

-- Trigger function to automatically update the 'updated_at' timestamp on vpr_test_attempts
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to execute the function before any update on vpr_test_attempts
CREATE TRIGGER update_vpr_test_attempts_modtime
BEFORE UPDATE ON public.vpr_test_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();

-- Grant basic permissions (adjust schema and roles as needed)
-- GRANT USAGE ON SCHEMA public TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_role;

COMMIT; -- Optional if running script in a transaction block