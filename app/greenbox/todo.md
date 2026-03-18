---
name: greenbox-core
description: Instant Korean 3D Tamagotchi simulation with magic-moment-first onboarding.
---

# Greenbox Core Extension

Purpose
Create Greenbox as the first fully iterator-native extension — simulation + minimal UI + instant Korean 3D magic moment.

## Iterator Instructions (Artificial General Iterator)
Goal: Keep pushing the Magic Moment closer to 0 seconds.
- Read this todo.
- Hypothesize extensions.
- Implement in one go.
- Measure: “User now feels X while still taking a shit.”
- Repeat on any “новый уровень” or genie-lamp trigger.

## Phase 1 — Magic Moment First
- [x] plugin.ts (manifest with instant-3d-korean-garden capability)
- [x] hydration.md (context + bathroom-test rule)
- [x] page.tsx + layout.tsx (onboarding + root with instant demo garden)
- [ ] createGardenAction + seedGardenAction in /app/core/garden_actions.ts
- [x] Add genie-lamp fake doors (auto irrigation, plant disease sim, AI gardener assistant)

## Phase 2 — Simulation
- [x] sim-jitter/todo.md — edge function plant-jitter
- [ ] UI controls for simulator (“Chaos Mode” switch)

## Phase 3 — Auto Extensions (Iterator will pick these up)
- [ ] pH for dummies genie lamp → instant academy page
- [ ] Korean 3D voice activation (“ready to garden like a fucking Korean in 3D 24/360?”)
- [x] Auto-poliv rule editor

## Fake Doors Register (новый этап «расфейковки»)

### Группа G1 — Контур датчиков и полива (строго последовательно)
1. `GBX-G1-S1` Датчики телеметрии: заменить фейковые env-метрики на серверный источник.
2. `GBX-G1-S2` Полив-очередь: подключить кнопку авто-полива к серверному действию и очереди. ✅
3. `GBX-G1-S3` История полива: добавить журнал и подтверждение выполнения цикла. ✅

Зависимость: шаги S1 → S2 → S3 выполняются только подряд.

### Группа G2 — Диагностика растений (можно параллельно группе G1)
1. `GBX-G2-S1` Приём фото листа и разбор симптомов (без рекомендаций).
2. `GBX-G2-S2` Рекомендации лечения + риск-оценка.

Зависимость: S2 зависит от S1.

### Группа G3 — Голосовой садовник (можно параллельно G1 и G2)
1. `GBX-G3-S1` Распознавание голоса и текстовый ответ.
2. `GBX-G3-S2` Озвучка ответа + сценарии «объясни как маме».

Зависимость: S2 зависит от S1.

### Параллельность между группами
- G1, G2 и G3 разрешено делать параллельно между собой.
- Внутри каждой группы шаги последовательные.


### UX-памятка для следующих шагов интеграции
- Удерживаем "мама-friendly" арт-направление: живой домашний сад, без холодного dashboard-стиля.
- Проверяем контраст в обеих темах (light/dark): заголовки и ключевые метрики не должны проваливаться в фон.
- Любая новая "реальная" фича сначала встраивается в приятную визуальную оболочку (fake-first -> unfake), чтобы мотивировать продолжать расфейковку.
- Адаптивность обязательна: мобильный первый экран должен оставаться читаемым без зума и горизонтального скролла.
- Перед закрытием каждой задачи расфейковки фиксируем, что UI остаётся "не-энтерпрайзным" и дружелюбным для не-технического пользователя.

Notes
- All UI texts RU-first and big-font for grandma usability.
- Iterator works for every plugin in the repo — just mention the name.
