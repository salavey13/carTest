-- Table to store temporary, in-progress survey states for users.
CREATE TABLE public.user_survey_state (
    user_id TEXT PRIMARY KEY,
    current_step INT NOT NULL DEFAULT 1,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES public.users(user_id)
        ON DELETE CASCADE
);

-- Table to store completed survey results.
CREATE TABLE public.user_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    username TEXT,
    survey_data JSONB NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES public.users(user_id)
        ON DELETE CASCADE
);