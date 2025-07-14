export const subcontexts = { // Export subcontexts list for direct access by name
    "Core Application Logic": [
        "next.config.mjs",
        "package.json",
        "tailwind.config.ts",
        "tsconfig.json",
        "types/database.types",
        "app/layout.tsx",
        "components/layout/",
        "app/globals.css",
        "contexts/AppContext.tsx",
        "hooks/supabase.ts",
        "lib/auth.ts",
        "lib/logger.ts",
        "lib/debugLogger.ts",
    ],
    "Arbitrage": [
        "app/arbitrage-explained",
        "app/arbitrage-live-scanner",
        "app/arbitrage-notdummies",
        "app/arbitrage-test-agent",
        "components/arbitrage",
        "app/elon", //contains "GodMode" features in subdirectories
        "app/elon/testbase",
        "supabase/migrations/market_data_1.sql",
        "hooks/useTradeSimulator.ts",
    ],
    "Webhooks and Telegram Bot": [
        "app/api/telegramWebhook/route.ts",
        "app/webhook-handlers",
        "app/actions.ts",
        "telegram.d.ts",
        "hooks/supabase.ts",
    ],
    "CyberFitness (Gamification)": [
        "app/cyberfitness",
        "hooks/cyberFitnessSupabase.ts",
    ],
    "PDF/TO Doc Processing": [
        "app/topdf",
        "app/todoc",
    ],
    "Tutorials/Examples": ["app/tutorials", "app/style-guide/page.tsx"],
    "Vibe Content Renderer": [
        "components/VibeContentRenderer.tsx",
        "lib/iconNameMap.ts",
    ],
    "Lead Generation & CRM": [
        "app/leads",
    ],
};