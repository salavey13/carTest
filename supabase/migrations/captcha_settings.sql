-- Drop the table if it exists to ensure a clean slate
DROP TABLE IF EXISTS settings;

-- Create the settings table
CREATE TABLE public.settings (
    id SERIAL PRIMARY KEY,
    string_length INT NOT NULL CHECK (string_length >= 4 AND string_length <= 8), -- Matches min/max in UI
    character_set TEXT NOT NULL CHECK (character_set IN ('letters', 'numbers', 'both')), -- Enum-like constraint
    case_sensitive BOOLEAN NOT NULL DEFAULT FALSE, -- Default to case-insensitive
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings (id = 1 as expected by the component)
INSERT INTO public.settings (id, string_length, character_set, case_sensitive)
VALUES (1, 4, 'both', FALSE);

-- Enable Row-Level Security (RLS)
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (everyone can see settings)
CREATE POLICY "Public can read settings" ON settings
    FOR SELECT
    USING (true);

-- Policy: Allow admins to update settings
CREATE POLICY "Admins can update settings" ON settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.users
            WHERE users.user_id = (auth.jwt() ->> 'chat_id') 
            AND users.status = 'admin'
        )
    );
