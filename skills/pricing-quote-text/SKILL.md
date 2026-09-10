---
name: pricing-quote-text
description: >
  Instant rental price quotes for VIP Bike. Calculate daily/hourly pricing with
  equipment add-ons, volume discounts, and deposits — all from Telegram.
  Mirrors the web app's pricing-calculator.ts logic.
  Trigger phrases (RU): "цена аренды", "стоимость аренды", "посчитай цену",
  "сколько стоит", "прайс", "тарифы", "депозит за байк", "сколько депозит".
  Trigger phrases (EN): "price quote", "rental cost", "how much", "pricing",
  "deposit", "tiers".
---

# Pricing Quote (text) — VIP Bike

Триггер-фразы (RU): **`цена аренды`**, **`стоимость аренды`**, **`посчитай цену`**, **`сколько стоит`**, **`прайс`**, **`тарифы`**, **`депозит за байк`**, **`сколько депозит`**.

## Overview

Text-based калькулятор цен аренды. Позволяет оператору за секунды посчитать стоимость аренды с экипировкой и депозита — прямо в Telegram при общении с клиентом.

## Commands

### 1. `quote` — расчёт стоимости аренды
```bash
node scripts/pricing-quote-skill.mjs quote --bike "MT-07" --days 3
node scripts/pricing-quote-skill.mjs quote --bike "MT-07" --hours 5
node scripts/pricing-quote-skill.mjs quote --bike "MT-07" --days 3 --helmets 2 --gloves 2
```

### 2. `deposit` — депозит за байк
```bash
node scripts/pricing-quote-skill.mjs deposit --bike "MT-07"
```

### 3. `tiers` — все тарифные сетки
```bash
node scripts/pricing-quote-skill.mjs tiers --bike "MT-07"
```

### 4. `list-prices` — прайс-лист всех байков
```bash
node scripts/pricing-quote-skill.mjs list-prices
```

## Pricing rules (tier model — зеркало `app/franchize/lib/pricing-calculator.ts`)

В вебе НЕТ процентных скидок (-10% / -15% — legacy-модель, НЕ использовать).
Цена считается по тарифам из `specs` карточки байка; каждая ставка — СУТОЧНАЯ/ПОЧАСОВАЯ и умножается на фактическую длительность.

**Почасово (< 24h):**

| Duration | Rule |
|----------|------|
| ≤ 1 час | `price_per_hour` × часы (fallback: `dailyPrice`) |
| 2 часа | точный тариф `price_per_2h`, если задан |
| 2–3 часа | интерполяция `price_per_hour` → `price_per_3h` |
| 3 часа | точный тариф `price_per_3h`, если задан |
| 3–6 ч / 6–12 ч | интерполяция между соседними тарифами (`price_per_6h`, `price_per_12h`) |
| 12–24 часа | интерполяция `price_per_12h` → дневная ставка |

**Посуточно (≥ 24h):** ставка выбирается по длительности и умножается на дни:

| Days | Rate (per-day) |
|------|----------------|
| 1 день | `rent_weekend` (если выходной) / `rent_weekday` / `daily_price` |
| 2–4 дня | `rent_2_4d` × дни |
| 5–10 дней | `rent_5_10d` × дни |
| 11–30 дней | `rent_11_30d` × дни |
| без тарифа | `daily_price` × дни |

Экипировка (канон 2026-09-11, `getEquipmentUnitPriceForRental()` / `gearUnitPrice()`): базовые цены фиксированы на каждом тарифе — шлем 1000 ₽/шт, прочее снаряжение 500 ₽/шт — но пропорциональны длительности аренды:

| Длительность | Шлем | Прочее снаряжение (шт) |
|------|------|------|
| Меньше суток (почасовая) | 500 ₽ | 250 ₽ |
| 1 сутки | 1000 ₽ | 500 ₽ |
| 2 суток | 1500 ₽ | 750 ₽ |
| 3 суток | 2000 ₽ | 1000 ₽ |
| каждые следующие сутки | +500 ₽ | +250 ₽ |

Зарядка — бесплатно (возвратная). Правило едино во ВСЕХ местах: веб-калькуляторы, конструктор договоров, предпросмотр /doc, модальное окно каталога и этот бот-котировщик — суммы обязаны сходиться копейка в копейку.

## Related files

- `scripts/pricing-quote-skill.mjs` — this skill's CLI
- `app/franchize/lib/pricing-calculator.ts` — web app's pricing logic
- `skills/vip-bike-ops/SKILL.md` — umbrella skill router
