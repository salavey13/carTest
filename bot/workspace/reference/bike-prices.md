# Прайс аренды VIP BIKE (DEPRECATED — emergency-fallback)

> ⚠️ **Definitive edition:** LIVE-прайс теперь берётся из Supabase через
> `npx tsx --env-file=.env modules/contract/cli.ts catalog find/show <bike>`.
> Этот файл — emergency-fallback ТОЛЬКО когда Supabase недоступен.
> Источник правды: таблица `cars.specs.{rent_weekday,rent_weekend,price_per_hour,sale_price,deposit_rub}`.
>
> Snapshot ниже от 2026-06-12 — может быть устаревшим. Не полагаться для договоров.

| Байк | slug | Будни ₽/сут | Выходные ₽/сут | Час | 3ч | 6ч | 12ч | 2-4д | 5-10д | 11-30д | Статус |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ducati Panigale S Electro | ducati-panigale-s-electro | 10000 | 12000 | 3000 | 6500 | 8500 | 10000 | 8000 | 7000 | 6000 | available |
| 79BIKE Falcon GT | falcon-gt-2025 | 12000 | 14000 | 5000 | 10000 | 12000 | 12000 | 10000 | 8000 | 7000 | available |
| 79BIKE Falcon Pro | falcon-pro-2025 | 10000 | 14000 | 5000 | 9000 | 10000 | 10000 | 8500 | 7000 | 6000 | available |
| KAWASAKI EX650K | kawasaki-ex650k | 16000 | 18000 | 5000 | 12000 | 14000 | 16000 | 13000 | 11000 | 9500 | available |
| Sequence Zero | sequence-zero | 15000 | 18000 | 3500 | 8000 | 12000 | 15000 | 12000 | 10000 | 9000 | available |
| Y-VOLT Surge V | y-volt-surge-v | 12000 | 15000 | 5000 | 10000 | 12000 | 12000 | 10000 | 8000 | 7000 | available |
| Regulmoto Nibbler 300 4V | nibbler-regumoto-4v | 6000 | 8000 | 2500 | 5500 | 5000 | 6000 | 5000 | 4000 | 3500 | available |
| Motoland Breakout 300 | motoland-breakout | 6000 | 8000 | 5000 | 6000 | 6000 | 6000 | 5000 | 4000 | 3500 | available |
| Sotion EM01 | sotion-em01 | 0 | — | — | — | — | — | — | — | — | available |
| HORWIN EK1 | horwin-ek1 | 0 | — | — | — | — | — | — | — | — | available |
| Suzuki GSX-S1000F | suzuki-gsx-s1000f | 14000 | 16000 | 5000 | 7000 | 9000 | 12000 | 11500 | 9500 | 8000 | available |

Правило: суточная цена = будни `rent_weekday`, в выходные `rent_weekend`. Если оператор назвал свою цену — приоритет у оператора.