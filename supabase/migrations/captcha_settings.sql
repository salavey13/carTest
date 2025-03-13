-- Drop the old table if it exists
DROP TABLE IF EXISTS settings;

-- Create the new settings table
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row
  string_length INTEGER NOT NULL DEFAULT 4 CHECK (string_length BETWEEN 4 AND 8),
  character_set TEXT NOT NULL DEFAULT 'both' CHECK (character_set IN ('letters', 'numbers', 'both')),
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  noise_level INTEGER NOT NULL DEFAULT 50 CHECK (noise_level BETWEEN 0 AND 100),
  font_size INTEGER NOT NULL DEFAULT 30 CHECK (font_size BETWEEN 20 AND 50),
  background_color TEXT NOT NULL DEFAULT '#f0f0f0',
  text_color TEXT NOT NULL DEFAULT '#333333',
  distortion REAL NOT NULL DEFAULT 0.4 CHECK (distortion BETWEEN 0 AND 1)
);

-- Insert default settings (single row)
INSERT INTO settings (id, string_length, character_set, case_sensitive, noise_level, font_size, background_color, text_color, distortion)
VALUES (1, 4, 'both', false, 50, 30, '#f0f0f0', '#333333', 0.4);

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
