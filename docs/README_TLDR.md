# TL;DR — Быстрый запуск своей версии

oneSitePls/carTest теперь разворачивается максимально просто: **форк → Codex → Vercel → Supabase init.sql**.

## Быстрые шаги
1. Сделай **fork** репозитория в свой GitHub.
2. Подключи форк к своему рабочему процессу в **Codex** (чатовый/локальный флоу).
3. Импортируй форк в **Vercel** и создай проект.
4. В Supabase выполни минимум: `supabase/migrations/20240101000000_init.sql`.
5. В Vercel добавь env-переменные (минимум):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_CHAT_ID`
   - `GITHUB_TOKEN`
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SITE_URL`
6. Deploy → открой свой домен и проверь ключевые страницы: `/`, `/nexus`, `/repo-xml`.

## Локально (опционально)
```bash
git clone https://github.com/<YOUR_USERNAME>/carTest.git
cd carTest
cp .env.example .env.local
npm install
npm run dev
```

Для полного контекста см. `README.MD`, `CONTRIBUTING.md`, `AGENTS.md`.


## Как не потерять обновления from upstream
После fork добавь upstream и периодически подтягивай изменения:

```bash
git remote add upstream https://github.com/<UPSTREAM_OWNER>/carTest.git
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

Так ты сохраняешь свой независимый деплой, но остаёшься в актуальном состоянии по апдейтам оригинального репо.
