-- 20260827130000_subrent_tiered_prices.sql
-- Subrent agreement alignment with the reference paper contract (Yamaha R7):
-- §5.1.1 uses TIERED minimum daily prices (1 сутки / 2+ суток / 3+ суток),
-- not a single flat minimum. Store the two additional tiers next to the
-- existing min_daily_price_rub column.
--
-- NOTE: the app inserts with a graceful fallback — until this migration is
-- applied, subrent artifacts are saved WITHOUT these two columns (no data
-- loss, tiers still render in the DOCX from the flow context).

ALTER TABLE private.subrent_contract_artifacts
  ADD COLUMN IF NOT EXISTS min_2plus_daily_price_rub TEXT;

ALTER TABLE private.subrent_contract_artifacts
  ADD COLUMN IF NOT EXISTS min_3plus_daily_price_rub TEXT;

COMMENT ON COLUMN private.subrent_contract_artifacts.min_2plus_daily_price_rub IS
  'Minimum price per day for rentals of 2+ days (contract §5.1.1, rub)';

COMMENT ON COLUMN private.subrent_contract_artifacts.min_3plus_daily_price_rub IS
  'Minimum price per day for rentals of 3+ days (contract §5.1.1, rub)';
