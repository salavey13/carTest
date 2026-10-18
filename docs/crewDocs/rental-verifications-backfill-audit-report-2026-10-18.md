# Аудит аренд Август–Октябрь 2026 (сверка готова к запуску)

Дата: 2026-10-18 · скрипт scripts/vf-b-audit.mjs · 189 аренд (без зеркал экипировки) · канонический снапшот комиссии заморожен в каждой строке.

## Итоги по месяцам

| месяц | fine | almost | sus | backfill строк |
|---|---|---|---|---|
| 2026-08 | 17 | 46 | 21 | 15 |
| 2026-09 | 54 | 20 | 6 | 45 |
| 2026-10 | 20 | 3 | 2 | 13 |

SQL к применению: `docs/crewDocs/rental-verifications-backfill-aug-oct-2026-10-18.sql` — 168 pending-сверок с оценкой в snapshot.audit. После применения: кнопка «✅ fine за ГГГГ-ММ» в полосе «🤝 Сверка» подтверждает месяц fine-строк одним тапом (владелец, preview → confirm).

### SUS — требуют ручного разбора — 29
Деньги на бумаге и в учёте расходятся (или договор/даты отсутствуют). Bulk-кнопка их НЕ трогает.

| id | байк | статус | сумма | месяц | заметки |
|---|---|---|---|---|---|
| 9c0ba304 | Wenbox U2 Pro | completed | 6000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; договор на бумаге 17000 ₽ против книг 6000 ₽ (депозит 10000 ₽) — расхождение бумага/учёт |
| f44fe33e | Motoland Breakout 300 | completed | 6000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; договор на бумаге 17000 ₽ против книг 6000 ₽ (депозит 10000 ₽) — расхождение бумага/учёт |
| 7b5c12ed | Yamaha R7 | completed | 5400 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; договор на бумаге 27400 ₽ против книг 5400 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| eb8f9728 | Sequence Zero | completed | 9000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; договор на бумаге 29500 ₽ против книг 9000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| b3e9b4a1 | Ducati Panigale S Electro Gold | completed | 7000 | 2026-08 | договор на бумаге 28500 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| 60d3defb | Regulmoto Nibbler 300 4V | completed | 6000 | 2026-08 | договор на бумаге 25000 ₽ против книг 6000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт |
| cb2dfa38 | Ducati Panigale S Electro Black Z | completed | 10000 | 2026-08 | договор на бумаге 32500 ₽ против книг 10000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| 1980d400 | Kawasaki EX650K (Ninja 650) | completed | 7000 | 2026-08 | completed без odometer_after; договор на бумаге 27500 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| e57a8ffc | 79BIKE Falcon GT | completed | 4000 | 2026-08 | договор на бумаге 16700 ₽ против книг 4000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт |
| d6187779 | Regulmoto Nibbler 300 4V | completed | 4000 | 2026-08 | договор на бумаге 25000 ₽ против книг 4000 ₽ (депозит 15000 ₽) — расхождение бумага/учёт |
| 24406a2d | Kawasaki EX650K (Ninja 650) | completed | 4000 | 2026-08 | doc_command: нет rental_contract_artifacts (договор не записан) |
| 4a3fe1a7 | BMW F800R | completed | 9000 | 2026-08 | договор на бумаге 30200 ₽ против книг 9000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| b5707303 | Ducati Panigale S Electro Black Z | completed | 12000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; doc_command: нет rental_contract_artifacts (договор не записан) |
| 38d38ec1 | Jilang Max Pro | completed | 5500 | 2026-08 | договор на бумаге 20000 ₽ против книг 5500 ₽ (депозит 15000 ₽) — расхождение бумага/учёт |
| 231970f8 | Ducati Panigale S Electro Black Aero | completed | 12000 | 2026-08 | payment_split (bank 13500 ₽ + cash 0 ₽) не сходится с total_cost 12000 ₽ (депозит 20000 ₽) — цену правили вручную?; договор на бумаге 33500 ₽ против книг 12000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| d2f83da7 | Ducati Panigale S Electro Black Z | completed | 11500 | 2026-08 | payment_split (bank 13000 ₽ + cash 0 ₽) не сходится с total_cost 11500 ₽ (депозит 20000 ₽) — цену правили вручную?; договор на бумаге 33000 ₽ против книг 11500 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| e3e4e1a3 | Aprilia Shiver 750 | completed | 13000 | 2026-08 | payment_split (bank 0 ₽ + cash 16000 ₽) не сходится с total_cost 13000 ₽ (депозит 20000 ₽) — цену правили вручную?; договор на бумаге 36000 ₽ против книг 13000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| e4791134 | Kawasaki EX650K (Ninja 650) | completed | 12000 | 2026-08 | payment_split (bank 10000 ₽ + cash 0 ₽) не сходится с total_cost 12000 ₽ (депозит 20000 ₽) — цену правили вручную? |
| 7bb1b3cc | Kawasaki EX650K (Ninja 650) | completed | 3500 | 2026-08 | депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0; payment_split (bank 3500 ₽ + cash 20000 ₽) не сходится с total_cost 3500 ₽ (депозит —) — цену правили вручную? |
| 08d80058 | Kawasaki EX650K (Ninja 650) | completed | 3750 | 2026-08 | договор на бумаге 3500 ₽ против книг 3750 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| d9dea17f | Ducati Panigale S Electro Black Z | completed | 7000 | 2026-08 | договор на бумаге 28000 ₽ против книг 7000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| 3bc69a27 | 79BIKE Falcon Lynx Purple | pending_confirmation | — | 2026-09 | конец раньше начала |
| 7641ee62 | Ducati Panigale S Electro Black Z | completed | 100 | 2026-09 | metadata: bike_price+equipment (1250 ₽) ≠ total_cost (100 ₽) |
| 693eacd0 | Aprilia Shiver 750 | completed | 100 | 2026-09 | metadata: bike_price+equipment (1250 ₽) ≠ total_cost (100 ₽) |
| 1ab2d8d4 | Ducati 1199 Panigale | completed | 25000 | 2026-09 | договор на бумаге 23500 ₽ против книг 25000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| ade49e6c | Ducati Panigale S Electro Black Aero | completed | 12500 | 2026-09 | payment_split (bank 0 ₽ + cash 14000 ₽) не сходится с total_cost 12500 ₽ (депозит 20000 ₽) — цену правили вручную?; договор на бумаге 34000 ₽ против книг 12500 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| 910a54c9 | Kawasaki EX650K (Ninja 650) | completed | 10000 | 2026-09 | договор на бумаге 15000 ₽ против книг 10000 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| add63811 | Yamaha R7 | completed | 7750 | 2026-10 | payment_split (bank 8500 ₽ + cash 0 ₽) не сходится с total_cost 7750 ₽ (депозит 20000 ₽) — цену правили вручную?; договор на бумаге 8500 ₽ против книг 7750 ₽ (депозит 20000 ₽) — расхождение бумага/учёт |
| 9d7582e5 | Motoland Breakout 300 | completed | 3500 | 2026-10 | metadata: bike_price+equipment (4450 ₽) ≠ total_cost (3500 ₽); договор на бумаге 14450 ₽ против книг 3500 ₽ (депозит 10000 ₽) — расхождение бумага/учёт |

### ALMOST — подтвердить после взгляда — 68
Учётные пробелы без расхождений в деньгах: легаси-закрытия без одометра/отметок возврата, депозит в split.cash.

| id | байк | статус | сумма | месяц | заметки |
|---|---|---|---|---|---|
| 955bd31a | Ducati Panigale S Electro Black Z | completed | 10000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| a2b8acde | VIP_BIKE Замена тормозных колодок (комплект) | completed | 1000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| ecfa174f | VIP_BIKE Ремонт и покраска накладки | completed | 750 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| fc927114 | VIP_BIKE Прокачка тормозов | completed | 500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 94b5b41d | Ducati Panigale S Electro Gold | completed | 10000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?) |
| 72ba2b09 | VIP_BIKE Покраска, снятие и установка боковины | completed | 1000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 932985a4 | VIP_BIKE Чистка и смазка цепи | completed | 625 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| fc7be22b | VIP_BIKE Снятие и установка переднего колеса с суппортом | completed | 350 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| b100a570 | VIP_BIKE Сборка байка | completed | 1250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| ed3ebad0 | VIP_BIKE Ослабление цепи | completed | 400 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| d8de0b35 | VIP_BIKE Сборка байка | completed | 2500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 73f05d0f | VIP_BIKE Замена концевиков | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 97f44178 | VIP_BIKE Проверка датчиков подножки / снятие нижних кожухов | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 7fb45254 | 79BIKE Falcon GT | completed | 7000 | 2026-08 | completed без odometer_after |
| 745bc221 | VIP_BIKE Замена правой водительской подножки | completed | 200 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 886ff577 | VIP_BIKE Замена ручки газа (с разбором) + замена фишки (электрика) | completed | 1000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| a0089e42 | VIP_BIKE Ремонт крепления плуга | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 59b77194 | VIP_BIKE Установка грипсов | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 7fde74ac | VIP_BIKE Крепление сиденья, покраска ручки с разбором пульта | completed | 200 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| f8a98f10 | VIP_BIKE Чистка, смазка и натяжка цепи | completed | 1250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| bdd9f40e | VIP_BIKE Ремонт подножки и датчика | completed | 750 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 59dc6799 | VIP_BIKE Чистка маятника и диска | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 899139d9 | VIP_BIKE Ремонт колеса (устранение задевания суппорта) | completed | 500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| b938ba57 | Meta Universal Helmet (All Sizes) | completed | 1000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| bfa273de | VIP_BIKE Сборка, замена втулок, установка зеркал | completed | 2250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 7b2bab65 | Ducati 1199 Panigale | completed | 0 | 2026-08 | total_cost = 0 без явной отметки ручной цены |
| 0d16c505 | VIP_BIKE Подтяжка цепи | completed | 650 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 0b18a045 | VIP_BIKE Смазка ручки переднего тормоза | completed | 50 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 76fd1ef8 | Meta Universal Helmet (All Sizes) | completed | 500 | 2026-08 | completed без odometer_after |
| d23a39b5 | VIP_BIKE Правка руля с колесом | completed | 600 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 82bd4189 | VIP_BIKE Диагностика проводки | completed | 500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| d674be86 | VIP_BIKE Снятие и установка накладки, крепление автомата | completed | 300 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 9fc0d73c | Ducati Panigale S Electro Black Aero | completed | 10000 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| c01cb3b3 | Aprilia Shiver 750 | completed | 11000 | 2026-08 | депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0 |
| d7e130f4 | Ducati Panigale S Electro Black Z | completed | 10000 | 2026-08 | депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0 |
| 0c484a4d | VIP_BIKE Снятие лапки КПП, ремонт подножки (установка болта), подкручивание пластика и плуга | completed | 300 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 6ba4cb61 | VIP_BIKE Ремонт правого зеркала | completed | 300 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 5029b66c | VIP_BIKE Правка переднего колеса со снятием боковых накладок | completed | 700 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 63d243f1 | Yamaha R6 | completed | 3500 | 2026-08 | депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0 |
| f61715a0 | Regulmoto Nibbler 300 4V | completed | 6003 | 2026-08 | депозит 20000 ₽ проведён в payment_split.cash, но rentals.deposit_amount = 0 |
| 29724478 | VIP_BIKE Замена переднего тормоза | completed | 500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| a4d761b4 | VIP_BIKE Снятие заднего колеса, замена колодок, снятие суппорта, смазка направляющих, прокачка заднего тормоза | completed | 900 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 18e8a405 | VIP_BIKE Замена автомата | completed | 500 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| f7c38961 | VIP_BIKE Установка аккумулятора и сидения | completed | 250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| d8729c0d | VIP_BIKE Сборка байка | completed | 1250 | 2026-08 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 08f15c1a | VIP_BIKE Сборка боковины и плуга, покраска зеркал и щёчек, покраска плуга (правая сторона) — подарок | completed | 0 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; total_cost = 0 без явной отметки ручной цены |
| 84c8344f | VIP_BIKE Подтяжка цепи | completed | 1250 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 1c9ca971 | Yamaha R7 | completed | 10000 | 2026-09 | completed без odometer_after |
| 71c61518 | VIP_BIKE Разборка приборной панели со снятием руля | completed | 500 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 24caedff | VIP_BIKE Опись мотоциклов | completed | 0 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after; total_cost = 0 без явной отметки ручной цены |
| b50ca7fb | Kawasaki EX650K (Ninja 650) | completed | 10000 | 2026-09 | completed без odometer_after |
| c3d885f6 | VIP_BIKE Правка руля с колесом | completed | 700 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| afb6e3aa | VIP_BIKE Установка защиты | completed | 200 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 87e80ac0 | VIP_BIKE Сборка байка | completed | 1000 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| e736951c | VIP_BIKE Установка задней звезды, установка переднего и заднего тормозных дисков | completed | 500 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| f627b17f | VIP_BIKE Замена переднего и заднего колеса на мотарде, с натяжкой цепи | completed | 1000 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 142d6e4a | 79BIKE Falcon GT | completed | 3750 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 734e63c5 | Kawasaki EX650K (Ninja 650) | completed | 11500 | 2026-09 | completed без odometer_after |
| a78ebd3c | Suzuki M109R 1800 Boulevard | completed | 16000 | 2026-09 | completed без odometer_after |
| 041aa9ce | 79BIKE Falcon Lynx Purple | completed | 2500 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 8d06a3ca | Ducati Panigale S Electro Black Aero | completed | 8000 | 2026-09 | completed без odometer_after |
| d49446f2 | Ducati Panigale S Electro Black Aero | completed | 4000 | 2026-09 | completed без odometer_after |
| 50f4c815 | BMW F800R | completed | 6400 | 2026-09 | completed без odometer_after |
| 2db2248d | Rerode R1+ | pending_confirmation | 0 | 2026-09 | total_cost = 0 без явной отметки ручной цены |
| a2658887 | BENDA LFC700 | completed | 53000 | 2026-09 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| d0a4748a | Honda CBR600RR | completed | 5750 | 2026-10 | completed без odometer_after |
| 24277629 | — VIP_BIKE Уборка шланга (за метр) | completed | 10.35 | 2026-10 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |
| 9991969f | Suzuki M109R 1800 Boulevard | completed | 3000 | 2026-10 | completed без return_confirmed_by/at (закрыт вне страницы возврата?); completed без odometer_after |

