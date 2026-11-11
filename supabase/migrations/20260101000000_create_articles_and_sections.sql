-- Advice articles + sections (public read, idempotent).
-- task177 chain-repair: real timestamp filename (was literal YYYYMMDDHHMMSS),
-- IF NOT EXISTS / policy guards for re-runs, auth.uid()::text cast (users.user_id is TEXT).

-- Create the articles table
CREATE TABLE IF NOT EXISTS public.articles (
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
CREATE TABLE IF NOT EXISTS public.article_sections (
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

-- Enable RLS for the new tables
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_sections ENABLE ROW LEVEL SECURITY;

-- Policies (guarded: CREATE POLICY has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='articles'
                 AND policyname='Allow public read access to articles') THEN
    CREATE POLICY "Allow public read access to articles"
    ON public.articles
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='article_sections'
                 AND policyname='Allow public read access to article sections') THEN
    CREATE POLICY "Allow public read access to article sections"
    ON public.article_sections
    FOR SELECT
    USING (true);
  END IF;

  -- users.user_id is TEXT, auth.uid() returns UUID → explicit cast (was: uuid = text operator error)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users'
                 AND policyname='Allow authenticated users to update their own metadata') THEN
    CREATE POLICY "Allow authenticated users to update their own metadata"
    ON public.users
    FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- Optional: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_sections_article_id ON public.article_sections(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON public.users USING GIN (metadata);

-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to new tables (drop-first for idempotency)
DROP TRIGGER IF EXISTS handle_articles_updated_at ON public.articles;
CREATE TRIGGER handle_articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS handle_article_sections_updated_at ON public.article_sections;
CREATE TRIGGER handle_article_sections_updated_at BEFORE UPDATE ON public.article_sections
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
