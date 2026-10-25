-- ═════════════════════════════════════════════════════════════════════════════
-- RENTAL PRICE CORRECTION — order-mvnr3g9c-bz30mf (two discounts, honest math)
-- 2026-10-25 · boss request (salavey13) · runs in Supabase SQL editor
-- ═════════════════════════════════════════════════════════════════════════════
--
-- ИСТОРИЯ:
--   Аренда Ducati Panigale S Electro Black Z, 25.10.2026 11:00 → 13:00,
--   арендатор Затонский Сергей (друг субарендатора — байк субарендаторский).
--
--   1. В корзине БЫЛ применён промокод колеса фортуны WHEEL2000 (−2 000 ₽):
--      парень реально крутил колесо и выиграл его по-честному.
--   2. Поверх — ручная скидка −1 000 ₽ (распоряжение сверху, salavey13).
--
--   ПРАВИЛЬНАЯ математика (boss):
--     4 750 (байк) + 250 (экипировка)  = 5 000
--   − 2 000 (промокод WHEEL2000)
--   − 1 000 (ручная скидка «сверху»)
--   = 2 000 ₽ итог (1 750 байк + 250 экипировка)
--
--   ⚠️ ПРЕДЫДУЩАЯ правка была НЕВЕРНОЙ: применила только −1 000 (5 000 →
--   4 000, «к оплате 24 000») и не учла промокод −2 000. Эта правка ставит
--   корректный итог и перезаписывает метку discount_rub=1000 из той правки.
--
--   Залог 20 000 ₽ — БЕЗ ИЗМЕНЕНИЙ.
--   Деньги: 22 000 ₽ (2 000 аренда + 20 000 залог) УЖЕ переведены на карту
--   Т-Банка 2026-10-25 — правка приводит запись в соответствие с реальностью.
--
--   Подписанный договор-файл остался со старой суммой — при выдаче ориентир:
--   22 000 ₽ к оплате (см. operator_comment в метаданных).
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1) DRY-RUN: смотрим строку ДО правки (должна быть ровно одна) ────────────
SELECT
  rental_id,
  total_cost,
  deposit_amount,
  deposit_method,
  status,
  payment_status,
  metadata->>'order_id'        AS order_id,
  metadata->>'renter_name'     AS renter_name,
  metadata->>'bike_name'       AS bike_name,
  metadata->>'bike_price'      AS bike_price,
  metadata->>'equipment_price' AS equipment_price,
  metadata->>'discount_rub'    AS old_discount_rub,
  metadata
FROM public.rentals
WHERE metadata->>'order_id'   = 'order-mvnr3g9c-bz30mf'
  AND metadata->>'renter_name' = 'Затонский Сергей';

-- ── 2) ПРАВКА (идемпотентна: повторный запуск даёт те же значения) ───────────
BEGIN;

UPDATE public.rentals
SET
  total_cost = 2000,
  updated_at = now(),
  metadata =
    metadata
    || jsonb_build_object(
      -- корректный разбор скидок (перезаписывает discount_rub=1000 прошлой правки)
      'discount_rub',           3000,
      'promo_code',             'WHEEL2000',
      'promo_discount_rub',     2000,
      'manual_discount_rub',    1000,
      'manual_discount_reason', 'Распоряжение сверху (salavey13): арендатор — друг субарендатора',
      'corrected_at',           to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS') || ' MSK',
      'corrected_by',           'salavey13',
      -- структурированная карточка правки (паттерн price_override)
      'price_correction', jsonb_build_object(
        'original_total_rub',   5000,
        'final_total_rub',      2000,
        'bike_price_rub',       GREATEST(2000 - COALESCE(NULLIF(metadata->>'equipment_price', '')::numeric, 0), 0),
        'equipment_price_rub',  COALESCE(NULLIF(metadata->>'equipment_price', '')::numeric, 0),
        'promo_code',           'WHEEL2000',
        'promo_discount_rub',   2000,
        'manual_discount_rub',  1000,
        'reason',               'Промокод WHEEL2000 (−2 000, колесо фортуны — выигран по-честному) + ручная скидка −1 000 (распоряжение сверху). Прошлая правка учла только −1 000 — исправлено.',
        'corrected_at',         to_char(now() AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD HH24:MI:SS') || ' MSK',
        'corrected_by',         'salavey13'
      ),
      -- комментарий операторам к аренде (просьба boss)
      'operator_comment',
        'Арендатор — друг субарендатора. Доп. скидка 1 000 ₽ — распоряжение сверху. ' ||
        'Парень тестировал колесо фортуны — промокод WHEEL2000 (−2 000 ₽) выиграл по-честному. ' ||
        '«Фото до» и начальный одометр добавил сам — молодец. ' ||
        'Оплачено 22 000 ₽ на карту Т-Банка: 2 000 аренда (1 750 байк + 250 экипировка) + 20 000 залог. ' ||
        'Подписанный договор остался со старой суммой — при выдаче ориентир 22 000 ₽.',
      'payment_note', '22 000 ₽ (2 000 аренда + 20 000 залог) получено на карту Т-Банка, 2026-10-25'
    )
    -- сплит байк/экипировка корректируем ТОЛЬКО если он хранился:
    -- байк несёт обе скидки, экипировка (250 ₽) не меняется
    || CASE
         WHEN metadata ? 'bike_price' THEN
           jsonb_build_object(
             'bike_price',
             GREATEST(2000 - COALESCE(NULLIF(metadata->>'equipment_price', '')::numeric, 0), 0)
           )
         ELSE '{}'::jsonb
       END
WHERE metadata->>'order_id'   = 'order-mvnr3g9c-bz30mf'
  AND metadata->>'renter_name' = 'Затонский Сергей';

-- ── 3) POST-CHECK: итог после правки ─────────────────────────────────────────
SELECT
  rental_id,
  total_cost,                                                    -- ожидаем 2000
  deposit_amount,                                                -- ожидаем 20000 (не трогали)
  total_cost + COALESCE(deposit_amount, 0) AS card_total_rub,    -- ожидаем 22000
  status,
  payment_status,
  metadata->>'discount_rub'          AS discount_rub,            -- ожидаем 3000
  metadata->>'promo_code'            AS promo_code,              -- WHEEL2000
  metadata->>'promo_discount_rub'    AS promo_discount_rub,      -- 2000
  metadata->>'manual_discount_rub'   AS manual_discount_rub,     -- 1000
  metadata->>'bike_price'            AS bike_price,              -- ожидаем 1750
  metadata->>'equipment_price'       AS equipment_price,         -- 250
  metadata->>'operator_comment'      AS operator_comment
FROM public.rentals
WHERE metadata->>'order_id'   = 'order-mvnr3g9c-bz30mf'
  AND metadata->>'renter_name' = 'Затонский Сергей';

COMMIT;
