-- /supabase/migrations/YYYYMMDDHHMMSS_create_articles_and_sections.sql
-- Create the articles table
CREATE TABLE public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add comments to articles table
COMMENT ON TABLE public.articles IS 'Stores information about advice articles.';
COMMENT ON COLUMN public.articles.id IS 'Unique identifier for the article.';
COMMENT ON COLUMN public.articles.title IS 'The main title of the article.';
COMMENT ON COLUMN public.articles.slug IS 'URL-friendly identifier for the article.';
COMMENT ON COLUMN public.articles.description IS 'A short description or summary of the article.';
COMMENT ON COLUMN public.articles.created_at IS 'Timestamp when the article was created.';
COMMENT ON COLUMN public.articles.updated_at IS 'Timestamp when the article was last updated.';

-- Create the article_sections table
CREATE TABLE public.article_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    section_order INTEGER NOT NULL, -- Renamed from 'order' to avoid SQL keyword conflict
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_article_order UNIQUE (article_id, section_order) -- Ensure order is unique per article
);

-- Add comments to article_sections table
COMMENT ON TABLE public.article_sections IS 'Stores individual sections of an article.';
COMMENT ON COLUMN public.article_sections.id IS 'Unique identifier for the section.';
COMMENT ON COLUMN public.article_sections.article_id IS 'Foreign key referencing the article this section belongs to.';
COMMENT ON COLUMN public.article_sections.section_order IS 'The numerical order of the section within the article.';
COMMENT ON COLUMN public.article_sections.title IS 'Optional title for the section.';
COMMENT ON COLUMN public.article_sections.content IS 'The main content of the section (can be Markdown, HTML, etc.).';
COMMENT ON COLUMN public.article_sections.created_at IS 'Timestamp when the section was created.';
COMMENT ON COLUMN public.article_sections.updated_at IS 'Timestamp when the section was last updated.';

-- Enable RLS for the new tables (Important!)
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_sections ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (adjust as needed)
CREATE POLICY "Allow public read access to articles"
ON public.articles
FOR SELECT
USING (true);

CREATE POLICY "Allow public read access to article sections"
ON public.article_sections
FOR SELECT
USING (true);

-- Allow authenticated users to update their own metadata
-- Ensure RLS is enabled on the users table first:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own data (if not already present)
-- CREATE POLICY "Allow users to view their own data"
-- ON public.users FOR SELECT
-- USING (auth.uid() = user_id::uuid); -- Adjust user_id type if needed

-- Policy to allow users to update their own metadata
CREATE POLICY "Allow users to update their own metadata"
ON public.users FOR UPDATE
USING (auth.uid() = user_id::uuid) -- Ensure user_id column exists and matches auth.uid() type
WITH CHECK (auth.uid() = user_id::uuid);

-- Optional: Add indexes for performance
CREATE INDEX idx_article_sections_article_id ON public.article_sections(article_id);
CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_users_metadata_gin ON public.users USING GIN (metadata); -- Index for JSONB queries

-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to articles and article_sections
CREATE TRIGGER handle_articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER handle_article_sections_updated_at BEFORE UPDATE ON public.article_sections
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();