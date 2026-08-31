-- 002_add_contract_type.sql  (идемпотентный ALTER TABLE)
-- Добавляет contract_type и поля купли-продажи в rental_contracts.
-- Применяется автоматически через applyMigrations() в getDb().
-- Для уже существующих строк: contract_type = 'rental' (DEFAULT).

ALTER TABLE rental_contracts ADD COLUMN contract_type   TEXT    NOT NULL DEFAULT 'rental';
ALTER TABLE rental_contracts ADD COLUMN sale_price      REAL;
ALTER TABLE rental_contracts ADD COLUMN sale_price_words TEXT;
ALTER TABLE rental_contracts ADD COLUMN prepayment      REAL;
ALTER TABLE rental_contracts ADD COLUMN prepayment_words TEXT;
ALTER TABLE rental_contracts ADD COLUMN warranty_months INTEGER;
CREATE INDEX IF NOT EXISTS idx_contracts_type ON rental_contracts (contract_type);
