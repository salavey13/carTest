-- 1. Create Subjects Table
CREATE TABLE public.subjects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g., 'Русский язык', 'Математика'
    description TEXT,          -- Optional: General info about VPR for this subject
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create VPR Questions Table
-- Renaming from 'questions' to avoid conflict if you keep the old one
CREATE TABLE public.vpr_questions (
    id SERIAL PRIMARY KEY,
    subject_id INT REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    text TEXT NOT NULL,         -- The question itself
    explanation TEXT,           -- Explanation of the correct answer
    position INT NOT NULL,      -- Order of question within the subject test
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (subject_id, position) -- Ensure unique positioning within a subject
);

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

-- REMOVE the old test_progress field from users if no longer needed for supercars
-- ALTER TABLE public.users DROP COLUMN test_progress;
-- OR just ignore it for the VPR app.