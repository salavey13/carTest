# carTest — TL;DR

## 1) Запуск через fork (коротко)
1. Fork репозитория в свой GitHub.
2. Подключение к Codex.
3. Деплой fork в Vercel.
4. Применить `supabase/migrations/20240101000000_init.sql`.
5. Поставить env из `.env.example`.

## 2) Синхронизация с upstream (коротко)
### Терминал
```bash
git remote add upstream https://github.com/<UPSTREAM_OWNER>/carTest.git
git checkout main
git fetch upstream
git merge upstream/main
# или: git rebase upstream/main
git push origin main
```

### Только браузер
- GitHub → твой fork → **Sync fork** → **Update branch**.
- Конфликты решай через conflict editor или PR из upstream в свой fork.

## 3) Обязательные env
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`
- `GEMINI_API_KEY`
- `NEXT_PUBLIC_SITE_URL`
