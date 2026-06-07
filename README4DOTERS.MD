# 🚗⚔️ CarTest — Web App Side Quest for Streamers & Gamers / RU+EN

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-^5-blue?logo=typescript&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-^14-black?logo=next.js&logoColor=white)]()
[![Supabase](https://img.shields.io/badge/Supabase-^2-3ECF8E?logo=supabase&logoColor=white)]()
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-^3-38B2AC?logo=tailwind-css&logoColor=white)]()
[![Telegram](https://img.shields.io/badge/Telegram-Bot%20%26%20Mini%20App-blue?logo=telegram)](https://t.me/oneSitePlsBot)
[![CI](https://github.com/<YOUR_ORG>/<YOUR_REPO>/actions/workflows/ci.yml/badge.svg)](https://github.com/<YOUR_ORG>/<YOUR_REPO>/actions) <!-- placeholder: замените -->
[![Coverage](https://img.shields.io/badge/coverage-unknown-lightgrey)]() <!-- placeholder: интегрируйте coverage и замените -->

---

## Кратко / TL;DR

CarTest — шаблон / платформа (Next.js + Supabase) для быстрого старта продуктов: аренда, стримерские фичи, внутренняя валюта (звёзды/XTR), Telegram-first workflow (бот + Mini App), Supervibe Studio для PR через Telegram.

**Вынесены/дополнены документы:**  
- `SECURITY.md` — инструкции по RLS, секреты и best-practices.  
- `MIGRATIONS.md` — supabase migrations + storage buckets инструкции.  
- `docs/FAQ_BUSINESS.md` — Mini-FAQ для бизнеса (SLA, integrations, white-label).  
- `docs/cases/sauna-flow.md` — пример: поток бронирования сауны.  
- `docs/cases/streamer-studio.md` — пример: workflow для стримера.  
- `docs/ASSETS.md` — оптимизация скриншотов, alt text, GIF.

---

## Что внутри (коротко)

- Next.js 14 (App Router), TypeScript, Supabase (Auth, Postgres, Storage, Realtime), Tailwind, shadcn/ui.
- Telegram Bot + WebApp SDK как основной вход для пользователей и флоу создания PR.
- Встроенная внутренняя валюта — *звёзды (XTR)* — для скидок, мотивации персонала, выплат.
- Supervibe Studio (`/repo-xml`) — contribute via Telegram Mini App (fetch code, ask AI, parse, create PR).

---

## Быстрый старт

1. Форкни репо:  
2.заполни ключи (Supabase, TELEGRAM\_BOT\_TOKEN, GITHUB\_TOKEN, AI keys).
3. Открой Telegram: @oneSitePlsBot → Supervibe Studio (`/repo-xml`) и попробуй **Fetch Files** → Ask AI → Create PR.

> Для локального теста Telegram WebApp используйте ngrok и укажите URL в настройках бота.

---

## Структура (кратко)

* `app/` — pages, server actions
* `components/` — UI компоненты
* `hooks/supabase.ts` — supabase client & helpers
* `webhook-handlers/` — платежи и Telegram webhook логика
* `docs/` — кейсы, инструкции, изображения

---

## Где смотреть детали

* Безопасность и RLS: `SECURITY.md`
* Миграции и storage: `MIGRATIONS.md`
* Бизнес-инфо (SLA, white-label): `docs/FAQ_BUSINESS.md`
* Кейсы: `docs/cases/sauna-flow.md`, `docs/cases/streamer-studio.md`
* Assets: `docs/ASSETS.md`

---

## Хотите автоматизировать?

Примеры фич, которые легко включить: бронирования с выставлением счёта в Telegram (звёзды/XTR), подписки на короткие смены клин-команды (оплата звёздами), уведомления владельцу, интеграция с ресепшеном отеля (штрих-коды), white-label для партнёров.

---

## License

Проект поставляется с `LICENSE` (Apache-2.0). `VIBE-LICENSE.md` — творческий манифест, не заменяет юридическую лицензию.