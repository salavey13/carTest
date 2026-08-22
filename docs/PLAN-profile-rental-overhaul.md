# Overhaul: Profile + Rental Detail Page

## 🔴 Problem 1: Legacy `/rentals/[id]` page

**Сейчас:** `app/rentals/[id]/page.tsx` — использует `ClientLayout` (старый cybervibe header/navbar), шрифт `font-orbitron`, цвета `brand-*`, `bg-background`/`text-foreground` (shadcn, не franchize). Без поддержки светлой темы.

**Надо:** Создать `/franchize/[slug]/rental/[rentalId]` — полноценная franchize-страница с:
- `FranchizePageShell` + `CrewHeader` + `CrewFooter`
- `useCrewTokens` + `crewPaletteForSurface` для темы
- Тот же handoff-флоу (фото ДО/ПОСЛЕ, подтверждение выдачи/возврата)
- Поддержка light/dark

## 🔴 Problem 2: Профиль ссылается на legacy

**Сейчас:** `profile-actions.ts:339` → `docLink: \`/rentals/\${r.rental_id}\``

**Надо:** `docLink: \`/franchize/vip-bike/rental/\${r.rental_id}\``

## 🔴 Problem 3: Color leaking в профиле

**Сейчас:** `ProfileClient.tsx` использует `--fr-profile-*` переменные + куча `color-mix(in srgb, ...)` вместо `T.styles.*` / `surface.*`. В light-теме остаётся золотистый оттенок от dark.

**Надо:** 
- Заменить все inline `style={{ borderColor, backgroundColor }}` на `T.styles.card` / `T.styles.subtleCard`
- Заменить `color-mix(...)` на `withAlpha(T.accent, ...)` 
- Убрать `--fr-profile-*` (не нужны, если используем `T.styles`)
- Использовать `crewPaletteForSurface` для muted text

## 🔵 Функционал: Rich rental cards в профиле

Добавить в карточки аренд:
- Фото байка (`SmartImage`)
- Даты аренды (start → end)
- Прогресс-бар (сколько дней прошло)
- CTA: «Подробнее» (ведёт на `/franchize/{slug}/rental/{id}`)

---

## Порядок имплементации

| Шаг | Что | Файлы |
|---|---|---|
| **1** | Franchize rental detail page | `app/franchize/[slug]/rental/[rentalId]/page.tsx` (new) |
| **2** | Profile: fix docLink → franchize | `profile-actions.ts` line 339 |
| **3** | Profile: fix color leaking | `ProfileClient.tsx` — замена `--fr-profile-*` на `T.styles.*` |
| **4** | Profile: rich rental cards | `ProfileClient.tsx` — даты, фото, прогресс |
| **5** | Commit + push | — |
