CREATE TABLE public.arbitrage_user_settings (
            user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
            settings JSONB NOT NULL,
            last_updated TIMESTAMPTZ DEFAULT now() NOT NULL,
            PRIMARY KEY (user_id)
        );

        ALTER TABLE public.arbitrage_user_settings ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Allow user to manage their own arbitrage settings"
        ON public.arbitrage_user_settings
        FOR ALL
        USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id);

        COMMENT ON TABLE public.arbitrage_user_settings IS 'Stores user-specific settings for the Arbitrage Alpha Seeker.';
        COMMENT ON COLUMN public.arbitrage_user_settings.settings IS 'JSONB object containing all arbitrage scanner preferences.';