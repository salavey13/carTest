-- ============================================================================
-- VIP BIKE ELECTRO — схема БД (Postgres) для бота договоров (ТРЕК A)
-- Источник полей: договор проката/аренды (Договор_проката_аренды_электромотоцикла.docx)
-- Скоуп фазы 1: ТОЛЬКО аренда (прокат). Купля-продажа — позже (отдельная форма).
--
-- 152-ФЗ: храним минимум ПДн, нужный для договора. Согласие на обработку ПДн —
-- пункт договора (раздел «Персональные данные»). Фото документов НЕ храним в БД —
-- только распознанные поля + ссылку на файл при необходимости (см. clients.doc_files).
-- ============================================================================

-- ── Арендодатель (наша сторона) — реквизиты, обычно одна активная строка ─────
CREATE TABLE IF NOT EXISTS lessor (
  id            SERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL DEFAULT 'ИП',          -- 'ИП' | 'ООО'
  name          TEXT NOT NULL,                        -- наименование / ФИО ИП        {{уточнить}}
  ogrn          TEXT,                                 -- ОГРНИП / ОГРН                 {{уточнить}}
  inn           TEXT,                                 -- ИНН                            {{уточнить}}
  address       TEXT,                                 -- юр. адрес                     {{уточнить}}
  signatory     TEXT,                                 -- «в лице ...»                  {{уточнить}}
  basis         TEXT,                                 -- «действующего на основании …» {{уточнить}}
  contacts      TEXT,                                 -- телефон/почта для договора
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Клиенты (Арендаторы) — из распознавания паспорта/прав (Z.AI vision) ───────
CREATE TABLE IF NOT EXISTS clients (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           TEXT NOT NULL DEFAULT 'гражданин', -- 'гражданин' | 'ИП' | 'ООО'
  full_name             TEXT NOT NULL,
  birth_date            DATE,
  -- паспорт РФ
  passport_series       TEXT,
  passport_number       TEXT,
  passport_issued_by    TEXT,
  passport_issued_date  DATE,
  passport_dept_code    TEXT,                          -- код подразделения
  registration_address  TEXT,                          -- адрес прописки
  -- водительское удостоверение
  license_number        TEXT,
  license_categories    TEXT,                          -- напр. «B», «A,B»
  license_issued_date   DATE,
  license_valid_until   DATE,
  -- юр. поля (если ИП/ООО)
  inn                   TEXT,
  ogrn                  TEXT,
  legal_address         TEXT,
  -- контакты
  phone                 TEXT,
  telegram              TEXT,
  -- служебное
  doc_files             JSONB DEFAULT '[]'::jsonb,      -- [{kind:'passport'|'license', path|url, sha256}]
  raw_ocr               JSONB,                          -- сырой ответ Z.AI vision (для аудита/правок)
  pdn_consent_at        TIMESTAMPTZ,                    -- отметка согласия на обработку ПДн
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients (lower(full_name));
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);

-- ── Конкретные ТС в прокате (единицы парка) ──────────────────────────────────
-- Спеки модели — из data/models.ts; per-unit (VIN/год/цвет) — {{уточнить у клиента}}.
CREATE TABLE IF NOT EXISTS bike_units (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_slug     TEXT,                                 -- связь с data/models.ts (напр. 'falcon-pro-yellow')
  make_model     TEXT NOT NULL,                        -- «79bike Falcon PRO»
  vin            TEXT,                                 -- серийный № рамы (VIN)         {{уточнить}}
  year           INT,                                  -- год выпуска                   {{уточнить}}
  color          TEXT,
  power_kw        TEXT,                                 -- номинальная мощность, кВт
  max_speed_kmh   TEXT,                                 -- макс. конструктивная скорость
  battery         TEXT,                                 -- тип/ёмкость АКБ
  status         TEXT NOT NULL DEFAULT 'available',    -- available | rented | service
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bike_units_model_slug ON bike_units (model_slug);

-- ── Договоры аренды ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rental_contracts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number  TEXT UNIQUE,                         -- № договора (генерируется)
  contract_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  city             TEXT NOT NULL DEFAULT 'Нижний Новгород',
  lessor_id        INT  REFERENCES lessor(id),
  client_id        UUID REFERENCES clients(id),
  bike_unit_id     UUID REFERENCES bike_units(id),
  -- срок
  rent_start       TIMESTAMPTZ,
  rent_end         TIMESTAMPTZ,
  return_address   TEXT,
  -- плата (раздел 4 договора)
  rate_type        TEXT,                                -- 'hour' | 'day'
  price_hour       NUMERIC(10,2),
  price_day        NUMERIC(10,2),
  deposit          NUMERIC(10,2),                       -- обеспечительный платёж
  -- документ
  status           TEXT NOT NULL DEFAULT 'draft',       -- draft | active | closed | cancelled
  docx_path        TEXT,                                -- путь к сгенерированному .docx
  pdf_path         TEXT,                                -- путь к .pdf (если генерим)
  original_sha256  TEXT,                                -- отпечаток документа (анти-фрод)
  created_by       TEXT,                                -- telegram_id оператора
  raw_inputs       JSONB,                               -- что ввёл оператор в боте
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON rental_contracts (client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON rental_contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_created ON rental_contracts (created_at DESC);

-- ── Операторы бота (контроль доступа) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
  telegram_id   BIGINT PRIMARY KEY,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'operator',       -- operator | admin
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
