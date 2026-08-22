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

## Pricing rules

| Duration | Rule |
|----------|------|
| ≤ 3 hours | = daily price |
| 1-6 days | daily × days |
| 7-13 days | -10% |
| 14+ days | -15% |

## Related files

- `scripts/pricing-quote-skill.mjs` — this skill's CLI
- `app/franchize/lib/pricing-calculator.ts` — web app's pricing logic
- `skills/vip-bike-ops/SKILL.md` — umbrella skill router
