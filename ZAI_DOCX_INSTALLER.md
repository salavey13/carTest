# DocXagent: ZAI Installer для генерации договоров
# ===================================================
#
# МИНУМАЛЬНЫЙ набор файлов для ZAI агента:
# - 2 файла навыков (skills/)
# - 3 CLI скрипта (scripts/)
# - 1 библиотека HTML→DOCX (lib/)
# - 2 HTML шаблона (docs/)
# - 5 SQL миграций (supabase/migrations/)
# - API route для Telegram (app/api/)
# - 3 компонента дашборда (app/franchize/)
#
# ПЕРЕД НАЧАЛОМ: Зайти в RepoTxtFetcher, нажать кнопку "DocX"
# для получения всех этих файлов из репозитория!
#
# ============== ЧТО НУЖНО ZAI ==============
#
# 1. ДОСТУП К SUPABASE (только 2 переменные!):
#    export SUPABASE_URL="https://xxx.supabase.co"
#    export SUPABASE_SERVICE_ROLE_KEY="eyJxxx..."
#
#    Всё! Никаких ZAI ключей - ZAI web агент имеет встроенный VLM.
#
# 2. СТРУКТУРА БАЗЫ:
#    - public.cars → данные о байках (type='bike')
#    - private.user_rental_secrets → данные арендаторов
#    - private.sale_contract_artifacts → данные продаж
#
# 3. ПОТОК РАБОТЫ:
#    Фото → ZAI VLM → JSON данные → HTML шаблон → DOCX → Supabase
#
# ================================================

# ФАЙЛ 1: skills/rental-contract-from-photos/SKILL.md
# Навык для генерации договора аренды из фото паспорта и ВУ

## Rental Contract from Photos

Extract data from Russian passport and driver's license photos, generate rental contract DOCX.

### Required Files
- scripts/make-rental-contract-skill.mjs
- lib/htmlToDocx.mjs
- docs/RENTAL_DEAL_TEMPLATE.html
- scripts/supabase-access-skill.mjs

### Environment Variables
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

### Workflow
1. Extract passport data: fullName, birthDate, series, number, issueDate, registration
2. Extract license data: fullName, series, number, categories, expiryDate
3. Fetch bike data from public.cars by bikeId
4. Render HTML template with variables
5. Convert to DOCX
6. Save to private.user_rental_secrets
7. Generate QR code for next rental

### API: Supabase REST
```bash
# Read bike
GET {SUPABASE_URL}/rest/v1/cars?id=eq.{bikeId}&type=eq.bike
Headers: apikey: {SUPABASE_SERVICE_ROLE_KEY}, Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}

# Write rental secrets
POST {SUPABASE_URL}/rest/v1/user_rental_secrets
Headers: apikey: {SUPABASE_SERVICE_ROLE_KEY}, Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}, Accept-Profile: private
Body: { doc_sha256, renter_full_name, renter_passport, ... }
```

# ================================================

# ФАЙЛ 2: skills/deal-contract-from-photos/SKILL.md
# Навык для генерации договора купли-продажи из фото паспорта

## Deal Contract from Photos

Extract data from Russian passport photo, generate sale contract DOCX.

### Required Files
- scripts/make-deal-contract-skill.mjs
- lib/htmlToDocx.mjs
- docs/SALE_DEAL_TEMPLATE.html
- scripts/supabase-access-skill.mjs

### Environment Variables
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

### Workflow
1. Extract passport data from photo
2. Fetch bike data from public.cars
3. Render HTML template
4. Convert to DOCX
5. Save to private.sale_contract_artifacts

# ================================================

# ФАЙЛ 3: scripts/supabase-access-skill.mjs
# Supabase REST API доступ через curl

```javascript
#!/usr/bin/env node
/**
 * Supabase access via REST API
 * ZAI может использовать этот паттерн для доступа к Supabase
 */

const [mode, ...args] = process.argv.slice(2);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function restRequest({ path, method = 'GET', body = null }) {
  const curl = spawnSync('curl', [
    '-sS', '-X', method,
    `${supabaseUrl}${path}`,
    '-H', `apikey: ${serviceRoleKey}`,
    '-H', `Authorization: Bearer ${serviceRoleKey}`,
    '-H', 'Content-Type: application/json',
    body ? '-d' : JSON.stringify(body) : []
  ]);
  return JSON.parse(curl.stdout);
}

// Пример: чтение байка
const bikeId = args[0];
const bike = restRequest({
  path: `/rest/v1/cars?id=eq.${bikeId}&type=eq.bike`
});
console.log(bike);

// Пример: запись секретов
const secrets = restRequest({
  path: '/rest/v1/user_rental_secrets',
  method: 'POST',
  body: { doc_sha256, renter_full_name, ... }
});
console.log(secrets);
```

# ================================================

# ФАЙЛ 4: lib/htmlToDocx.mjs
# Конвертация HTML в DOCX

```javascript
import { Document, Packer, Paragraph, TextRun } from 'docx';
import * as cheerio from 'cheerio';

export function htmlToDocx(html, options = {}) {
  const $ = cheerio.load(html);
  const children = [];

  $('*').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      children.push(new Paragraph({
        children: [new TextRun({ text, font: 'Times New Roman' })]
      }));
    }
  });

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
```

# ================================================

# ФАЙЛ 5: supabase/migrations/20240101000000_init.sql
# Таблица public.cars для данных о байках

```sql
CREATE TABLE public.cars (
  id TEXT PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  description TEXT NOT NULL,
  daily_price NUMERIC NOT NULL,
  image_url TEXT NOT NULL,
  rent_link TEXT NOT NULL,
  type TEXT DEFAULT 'car',
  specs JSONB DEFAULT '{}',
  owner_id TEXT
);

ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON cars FOR SELECT USING (true);

-- Пример данных
INSERT INTO public.cars (id, make, model, description, daily_price, type) VALUES
('bmw-s1000rr', 'BMW', 'S1000RR', 'Немецкий суперспорт...', 1200, 'bike');
```

# ================================================

# ФАЙЛ 6: supabase/migrations/20260601000000_user_rental_secrets.sql
# Private схема для данных арендаторов

```sql
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE private.user_rental_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,                           -- NULL до сканирования QR
  crew_slug TEXT NOT NULL,
  doc_sha256 TEXT NOT NULL UNIQUE,
  renter_full_name TEXT,
  renter_passport TEXT,
  renter_passport_issue_date TEXT,
  renter_passport_issued_by TEXT,
  renter_registration TEXT,
  renter_driver_license TEXT,
  renter_birth_date TEXT,
  renter_phone TEXT,
  renter_email TEXT,
  renter_address TEXT,
  verification_status TEXT DEFAULT 'verified',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.user_rental_secrets TO service_role;
```

# ================================================

# ФАЙЛ 7: docs/RENTAL_DEAL_TEMPLATE.html
# Шаблон договора аренды (сокращённая версия)

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Договор аренды транспортного средства</title>
</head>
<body>
<h1>ДОГОВОР АРЕНДЫ ТРАНСПОРТНОГО СРЕДСТВА № {{contract_number}}</h1>

<p>г. {{city}} «{{day}}» {{month}} {{year}} года</p>

<h2>Стороны:</h2>
<p><strong>Арендодатель:</strong> {{renter_full_name}}</p>
<p><strong>Арендатор:</strong> {{bike_make_model}}</p>

<h2>Предмет договора:</h2>
<p>Арендодатель предоставляет в аренду транспортное средство:</p>
<ul>
  <li>Марка: {{bike_make}}</li>
  <li>Модель: {{bike_model}}</li>
  <li>VIN: {{bike_vin}}</li>
  <li>Гос. номер: {{bike_plate}}</li>
</ul>

<h2>Арендатор:</h2>
<ul>
  <li>ФИО: {{renter_full_name}}</li>
  <li>Паспорт: {{renter_passport}}</li>
  <li>ВУ: {{renter_driver_license}}</li>
  <li>Адрес: {{renter_address}}</li>
  <li>Телефон: {{renter_phone}}</li>
</ul>

<h2>Условия:</h2>
<p>Период аренды: с {{rent_start_date}} по {{rent_end_date}}</p>
<p>Стоимость: {{daily_price_rub}} руб/день</p>
<p>Залог: {{deposit_rub}} руб</p>

<p>Подписи:</p>
<p>Арендодатель: _________________</p>
<p>Арендатор: _________________</p>
</body>
</html>
```

# ================================================

# ФАЙЛ 8: app/api/forward-telegram/route.ts
# API для отправки файлов в Telegram (когда бот заблокирован)

```typescript
/**
 * POST /api/forward-telegram
 *
 * Использование:
 * {
 *   "chat_id": "123456789",
 *   "method": "sendDocument",
 *   "payload": { "caption": "Ваш документ" },
 *   "files": {
 *     "document": { "data": "<base64_docx>", "filename": "contract.docx" }
 *   }
 * }
 *
 * ZAI может отправить сгенерированный DOCX через этот API!
 */
```

# ================================================

# ФАЙЛ 9: QR коды (опционально)
# Генерация QR кодов для быстрой аренды

```javascript
/**
 * Генерация QR кода для "1-click next rent"
 * Формат: t.me/oneBikePlsBot/app?startapp=rent_{bikeId}_{docSha256}
 */

const qrLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bikeId}_${docSha256}`;

// Вариант 1: через qrserver API (бесплатно, без npm)
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrLink)}`;

// Вариант 2: через qrcode npm пакет
// import QRCode from 'qrcode';
// const qrImage = await QRCode.toDataURL(qrLink);

// Вариант 3: через qrcode-terminal (для CLI)
// import QRCode from 'qrcode-terminal';
// QRCode.generate(qrLink, { small: true });
```

# ================================================

# КАК ИСПОЛЬЗОВАТЬ ЭТОТ INSTALLER:

## ВАРИАНТ 1: Через RepoTxtFetcher (РЕКОМЕНДУЕТСЯ)

1. Откройте RepoTxtFetcher в приложении
2. Нажмите фиолетовую кнопку **"DocX"** с роботом
3. Все файлы будут извлечены и готовы к копированию
4. Скопируйте и прикрепите к запросу ZAI

## ВАРИАНТ 2: Вручную

1. Скопируйте каждый файл из репозитория по путям выше
2. Прикрепите к запросу ZAI

# ================================================

# ПРИМЕР ЗАПРОСА К ZAI:

"""
ZAI, я дал тебе файлы для генерации договоров аренды/продажи.

Твоя задача:
1. Извлечь данные из фото паспорта/ВУ (используй встроенный VLM)
2. Прочитать данные байка из Supabase public.cars (type='bike')
3. Сгенерировать DOCX из HTML шаблона (используй cheerio + docx)
4. Сохранить в private.user_rental_secrets через Supabase REST API
5. (Опционально) Отправить через https://v0-car-test.vercel.app/api/forward-telegram
6. (Опционально) Сгенерировать QR код для быстрой аренды

Переменные окружения (только эти 2!):
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Никаких ZAI ключей не нужно - используй встроенный VLM.
"""

# ================================================

# ВСЁ! Готово к работе с ZAI.

# ПРОВЕРКА РЕЗУЛЬТАТА:

✅ Данные извлечены из фото паспорта/ВУ
✅ Данные байка прочитаны из Supabase
✅ DOCX сгенерирован из HTML шаблона
✅ Данные сохранены в private.user_rental_secrets
✅ (Опционально) Документ отправлен в Telegram
✅ (Опционально) QR код сгенерирован

# ================================================
