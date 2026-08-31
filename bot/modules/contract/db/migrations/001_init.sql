-- ============================================================================
-- VIP BIKE ELECTRO — схема БД (SQLite / better-sqlite3) для бота договоров
-- Портировано из Postgres ТРЕК A.
-- 152-ФЗ: храним только распознанные поля, не фото документов.
-- ============================================================================

-- ── Арендодатель ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessor (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT    NOT NULL DEFAULT 'ИП',
  name          TEXT    NOT NULL,
  ogrn          TEXT,
  inn           TEXT,
  address       TEXT,
  signatory     TEXT,
  basis         TEXT,
  contacts      TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,          -- 0/1 (boolean)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Клиенты (Арендаторы) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                    TEXT PRIMARY KEY,             -- crypto.randomUUID() из кода
  entity_type           TEXT NOT NULL DEFAULT 'гражданин',
  full_name             TEXT NOT NULL,
  birth_date            TEXT,                         -- ISO YYYY-MM-DD
  passport_series       TEXT,
  passport_number       TEXT,
  passport_issued_by    TEXT,
  passport_issued_date  TEXT,                         -- ISO YYYY-MM-DD
  passport_dept_code    TEXT,
  registration_address  TEXT,
  license_number        TEXT,
  license_categories    TEXT,
  license_issued_date   TEXT,                         -- ISO YYYY-MM-DD
  license_valid_until   TEXT,                         -- ISO YYYY-MM-DD
  inn                   TEXT,
  ogrn                  TEXT,
  legal_address         TEXT,
  phone                 TEXT,
  telegram              TEXT,
  doc_files             TEXT    NOT NULL DEFAULT '[]', -- JSON array
  raw_ocr               TEXT,                         -- JSON object
  pdn_consent_at        TEXT,                         -- ISO datetime
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_clients_phone    ON clients (phone);

-- ── Конкретные ТС в прокате ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bike_units (
  id             TEXT    PRIMARY KEY,                 -- crypto.randomUUID()
  model_slug     TEXT,
  make_model     TEXT    NOT NULL,
  vin            TEXT,
  year           INTEGER,
  color          TEXT,
  power_kw       TEXT,
  max_speed_kmh  TEXT,
  battery        TEXT,
  status         TEXT    NOT NULL DEFAULT 'available',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bike_units_model_slug ON bike_units (model_slug);

-- ── Договоры аренды ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_contracts (
  id               TEXT    PRIMARY KEY,               -- crypto.randomUUID()
  contract_number  TEXT    UNIQUE,
  contract_date    TEXT    NOT NULL DEFAULT (date('now')),  -- ISO YYYY-MM-DD
  city             TEXT    NOT NULL DEFAULT 'Нижний Новгород',
  lessor_id        INTEGER REFERENCES lessor(id),
  client_id        TEXT    REFERENCES clients(id),
  bike_unit_id     TEXT    REFERENCES bike_units(id),
  rent_start       TEXT,                              -- ISO datetime
  rent_end         TEXT,                              -- ISO datetime
  return_address   TEXT,
  rate_type        TEXT,                              -- 'hour' | 'day'
  price_hour       REAL,
  price_day        REAL,
  deposit          REAL,
  status           TEXT    NOT NULL DEFAULT 'draft',
  docx_path        TEXT,
  pdf_path         TEXT,
  original_sha256  TEXT,
  created_by       TEXT,
  raw_inputs       TEXT,                              -- JSON object
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contracts_client  ON rental_contracts (client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status  ON rental_contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_created ON rental_contracts (created_at DESC);

-- ── Операторы бота ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  telegram_id   INTEGER PRIMARY KEY,
  name          TEXT,
  role          TEXT    NOT NULL DEFAULT 'operator',
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
