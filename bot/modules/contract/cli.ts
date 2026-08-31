/**
 * modules/contract/cli.ts
 * CLI-оболочка для модуля договоров. Запуск: npx tsx modules/contract/cli.ts <command> [flags]
 *
 * Команды (definitive edition — с LIVE прайсом из Supabase):
 *   recognize --passport <path> [--license <path>]
 *     → JSON { fields, mock } в stdout
 *
 *   prep --passport <p> --license <l> --bike-slug <slug> --start <ISO>
 *        [--days N | --hours N | --end <ISO>] [--type rental|sale]
 *     → JSON { status: ready|catalog-only|multiple-bikes, card, stagedPath, ... }
 *
 *   gen-contract --client <ocr-fields.json> --bike <bike-id>
 *                --start <ISO> --end <ISO>
 *                [--tariff hour|day] [--deposit <n>]
 *                [--price-hour <n>] [--price-day <n>]
 *                [--out-dir <dir>] [--consent] [--cleanup-files <p1,p2,...>] [--email]
 *     → JSON { path, contractNumber, sha256, cleaned, emailed } в stdout
 *     --consent       проставить pdn_consent_at (оператор подтвердил согласие на ПДн)
 *     --cleanup-files после успешной генерации детерминированно удалить фото из uploads/
 *     --email         сразу отправить готовый .docx на почту проката + копия оператору
 *                     (один вызов = генерация + письмо + чистка ПДн)
 *
 *   migrate
 *     → применить db/schema.sql (CREATE TABLE IF NOT EXISTS)
 *
 *   catalog find|show|list|add-bike|add-lead|add-callback-lead|add-avito-lead
 *     → работа с каталогом Supabase (cars) и лидами (franchize_intents).
 *       add-lead         — лид на ПОКУПКУ байка (Avito/оператор, intent=prebuy).
 *       add-callback-lead — CUSTOMER CTA с vip-bike.ru (intent=callback_request,
 *                          форвард из Telegram, с дедупом по phone за 2ч).
 *       add-avito-lead   — CUSTOMER Avito-заявка (форвард оператором,
 *                          contact_channel=avito, дедуп по phone за 2ч).
 *       Mirror паттернов: doc-manual.ts (vip-bike-rental).
 *
 * 152-ФЗ: --passport/--license и --cleanup-files принимают пути ТОЛЬКО внутри
 * CONTRACTS_UPLOADS_DIR (дефолт workspace/uploads) — защита от path traversal.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { recognizeClient } from './lib/recognize.js';
import {
  findBikeInCatalog,
  getBikeById,
  listCrewBikes,
  getBikeBySlug,
  enrichLocalBikeFromCatalog,
  formatBikeLine,
  formatPriceCard,
  extractPriceCard,
  defaultCrewSlug,
  addBikeToCatalog,
  addLead,
  addCallbackLead,
  addAvitoLead,
  type CatalogBike,
} from './lib/supabase.js';
import {
  createClient,
  createContract,
  createBikeUnit,
  getActiveLessor,
  getBikeUnit,
  attachContractDoc,
  getClient,
  findClients,
  findBikeUnitsByName,
  findBikeUnitsBySlug,
  listContracts,
} from './lib/contracts.js';
import { generateContract } from './lib/contractDoc.js';
import { getDb } from './lib/db.js';
import type { ClientOcrFields } from './lib/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = 'true';
      }
    }
  }
  return flags;
}

function die(msg: string): never {
  console.error(`cli error: ${msg}`);
  process.exit(1);
}

/** Разрешённая папка загрузок (ПДн-фото). Пути извне неё отклоняются (path traversal). */
const UPLOADS_DIR = path.resolve(process.env.CONTRACTS_UPLOADS_DIR ?? 'workspace/uploads');

/** Разрешённая папка для сохранения готовых договоров. */
const STORE_DIR = path.resolve(process.env.CONTRACTS_STORE_DIR ?? 'workspace/store');

/**
 * Resolve + проверка, что путь лежит ВНУТРИ UPLOADS_DIR. Иначе — die.
 * Через fs.realpathSync (обе стороны) — чтобы симлинк внутри uploads, указывающий
 * наружу, тоже отвергался (defense-in-depth, 152-ФЗ). Для несуществующих путей —
 * лексический fallback (readFileSync/unlink сами бросят ENOENT).
 */
function assertInUploads(filePath: string): string {
  const realBase = fs.existsSync(UPLOADS_DIR) ? fs.realpathSync(UPLOADS_DIR) : UPLOADS_DIR;
  const resolved = path.resolve(filePath);
  const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
  if (real !== realBase && !real.startsWith(realBase + path.sep)) {
    die(`путь вне разрешённой папки uploads: ${filePath} (ожидается внутри ${UPLOADS_DIR})`);
  }
  return real;
}

/**
 * M1: resolve + проверка, что путь лежит ВНУТРИ STORE_DIR. Иначе — die.
 */
function assertInStoreDir(dirPath: string): string {
  const realBase = fs.existsSync(STORE_DIR) ? fs.realpathSync(STORE_DIR) : STORE_DIR;
  const resolved = path.resolve(dirPath);
  const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
  if (real !== realBase && !real.startsWith(realBase + path.sep)) {
    die(`--out-dir вне разрешённой папки store: ${dirPath} (ожидается внутри ${STORE_DIR})`);
  }
  return real;
}

function readFileAsBase64(filePath: string): { base64: string; mime: string } {
  const safe = assertInUploads(filePath);
  const buf = fs.readFileSync(safe);
  const ext = path.extname(safe).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { base64: buf.toString('base64'), mime };
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdRecognize(flags: Record<string, string>): Promise<void> {
  const passportPath = flags['passport'];
  const licensePath = flags['license'];
  const registrationPath = flags['registration'];
  if (!passportPath && !licensePath) die('нужен хотя бы --passport или --license');

  const docs: {
    passport?: { base64: string; mime: string };
    license?: { base64: string; mime: string };
    registration?: { base64: string; mime: string };
  } = {};
  if (passportPath) docs.passport = readFileAsBase64(passportPath);
  if (licensePath) docs.license = readFileAsBase64(licensePath);
  if (registrationPath) docs.registration = readFileAsBase64(registrationPath);

  const result = await recognizeClient(docs);
  process.stdout.write(JSON.stringify({ fields: result.fields, mock: result.mock }, null, 2) + '\n');
}

// ── Ускорение: prep + staged ──────────────────────────────────────────────────
// Поля клиента, которые оператор может править через --set (whitelist, без инъекций).
const SETTABLE_FIELDS = new Set<keyof ClientOcrFields>([
  'fullName', 'birthDate', 'passportSeries', 'passportNumber', 'passportIssuedBy',
  'passportIssuedDate', 'passportDeptCode', 'registrationAddress', 'phone',
  'licenseNumber', 'licenseIssuedDate', 'licenseCategories', 'inn', 'ogrn',
] as (keyof ClientOcrFields)[]);

function pad2(n: number): string { return String(n).padStart(2, '0'); }

/**
 * Дата конца аренды из старта + длительности. Без shell `date -d`, детерминированно.
 * Старт трактуем как стенные часы МСК (UTC+3 без перехода) → UTC-арифметика без сдвига.
 */
function computeEndISO(startISO: string, days: number, hours: number): string {
  const m = startISO.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) die(`--start неверный формат, нужен YYYY-MM-DDTHH:MM (получено: ${startISO})`);
  const [, Y, Mo, D, H, Mi] = m.map(Number);
  const dt = new Date(Date.UTC(Y, Mo - 1, D, H, Mi));
  dt.setUTCDate(dt.getUTCDate() + days);
  dt.setUTCHours(dt.getUTCHours() + hours);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}T${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:00`;
}

/** Строка прайса байка из workspace/reference/bike-prices.md по slug (verbatim, для карточки). */
function priceLineForSlug(slug: string): string | null {
  const pricesPath = path.resolve('workspace', 'reference', 'bike-prices.md');
  if (!fs.existsSync(pricesPath)) return null;
  const line = fs.readFileSync(pricesPath, 'utf8')
    .split('\n')
    .find((l) => l.includes(`| ${slug} |`) || l.includes(`|${slug}|`));
  return line ? line.trim() : null;
}

/** Применить --set field=value к OCR-полям (whitelist). Несколько --set собираются из argv. */
function applySetOverrides(fields: ClientOcrFields, rawArgs: string[]): string[] {
  const applied: string[] = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] !== '--set') continue;
    const pair = rawArgs[i + 1] ?? '';
    const eq = pair.indexOf('=');
    if (eq < 0) die(`--set ожидает field=value (получено: ${pair})`);
    const key = pair.slice(0, eq).trim() as keyof ClientOcrFields;
    const value = pair.slice(eq + 1);
    if (!SETTABLE_FIELDS.has(key)) die(`--set: поле "${key}" нельзя править (разрешены: ${[...SETTABLE_FIELDS].join(', ')})`);
    (fields as Record<string, unknown>)[key] = value;
    applied.push(`${key}=${value}`);
  }
  return applied;
}

interface StagedContract {
  client: ClientOcrFields;
  bikeId: string;
  makeModel?: string;
  vin?: string | null;
  rentStart: string;
  rentEnd: string;
  contractType: 'rental' | 'sale';
  photos: string[];
}

/**
 * prep — ОДИН вызов: распознать документы + найти байк + посчитать даты + собрать
 * карточку полей для оператора. Пишет staged-JSON. Бот показывает карточку → ОК →
 * gen-contract --staged. Цену оператор подтверждает (прайс многоуровневый — деньги не угадываем).
 */
async function cmdPrep(flags: Record<string, string>): Promise<void> {
  const passportPath = flags['passport'];
  const licensePath = flags['license'];
  const registrationPath = flags['registration'];
  const bikeQuery = flags['bike-query'];
  const bikeSlug = flags['bike-slug'];
  const bikeIdFlag = flags['bike'];
  const start = flags['start'];
  const contractType = (flags['type'] as 'rental' | 'sale') ?? 'rental';

  if (!passportPath && !licensePath) die('нужен хотя бы --passport или --license');
  if (!bikeQuery && !bikeSlug && !bikeIdFlag) die('нужен --bike-query "<модель>" (или --bike-slug / --bike <id>)');
  if (!start) die('нужен --start <YYYY-MM-DDTHH:MM>');

  // 1. Распознавание (1 вызов на все фото)
  const docs: {
    passport?: { base64: string; mime: string };
    license?: { base64: string; mime: string };
    registration?: { base64: string; mime: string };
  } = {};
  const photos: string[] = [];
  if (passportPath) { docs.passport = readFileAsBase64(assertInUploads(passportPath)); photos.push(assertInUploads(passportPath)); }
  if (licensePath) { docs.license = readFileAsBase64(assertInUploads(licensePath)); photos.push(assertInUploads(licensePath)); }
  if (registrationPath) { docs.registration = readFileAsBase64(assertInUploads(registrationPath)); photos.push(assertInUploads(registrationPath)); }
  const recognized = await recognizeClient(docs);
  const fields = recognized.fields;

  // 2. Резолв байка из БД (идентичность). Цену НЕ выбираем — отдаём прайс-строку оператору.
  const warnings: string[] = [];
  let bike = bikeIdFlag ? getBikeUnit(bikeIdFlag) : null;
  if (!bike) {
    const candidates = bikeSlug
      ? findBikeUnitsByName(bikeSlug)
      : findBikeUnitsByName(bikeQuery ?? '');
    if (candidates.length === 0) {
      // Локально пусто — пробуем каталог Supabase (definitive edition).
      const q = bikeQuery ?? bikeSlug ?? '';
      let catalogCandidates: CatalogBike[] = [];
      try {
        catalogCandidates = await findBikeInCatalog(q, defaultCrewSlug());
      } catch (e) {
        die(
          `байк не найден локально, и Supabase-каталог недоступен: ${(e as Error).message}. ` +
          `Добавь юнит через: catalog add-bike --from-catalog <id> --sync-local`,
        );
      }
      if (catalogCandidates.length === 0) {
        die(`байк не найден ни локально, ни в Supabase по запросу "${q}".`);
      }
      // Отдаём список кандидатов из каталога — оператор добавит нужный локально.
      const list = catalogCandidates
        .map((b) => `  - ${b.make} ${b.model} (id: ${b.id})`)
        .join('\n');
      process.stdout.write(JSON.stringify({
        status: 'catalog-only',
        message: `Локально байка нет. Найден в каталоге Supabase. Сначала добавь юнит:`,
        hint: `catalog add-bike --from-catalog <id> --sync-local   (затем повтори prep)`,
        catalogCandidates: catalogCandidates.map((b) => ({
          id: b.id, make: b.make, model: b.model,
          price: extractPriceCard(b),
        })),
        text: list,
      }, null, 2) + '\n');
      return;
    }
    if (candidates.length > 1) {
      const list = candidates.map((b) => `  - ${b.makeModel} (slug: ${b.modelSlug}, id: ${b.id})`).join('\n');
      process.stdout.write(JSON.stringify({
        status: 'multiple-bikes',
        message: `Несколько байков по запросу "${bikeQuery ?? bikeSlug}". Уточни оператору, повтори prep с --bike-slug <slug>:`,
        candidates: candidates.map((b) => ({ id: b.id, makeModel: b.makeModel, slug: b.modelSlug })),
        text: list,
      }, null, 2) + '\n');
      return;
    }
    bike = candidates[0];
  }

  // 2b. Обогатить локальный байк каталогом Supabase (прайс/specs — LIVE).
  //     Молчаливый fallback: если Supabase недоступен — остаётся только локальный прайс.
  let catalogBike: CatalogBike | null = null;
  try {
    catalogBike = await enrichLocalBikeFromCatalog({
      modelSlug: bike.modelSlug,
      makeModel: bike.makeModel,
      vin: bike.vin,
      year: bike.year,
      color: bike.color,
    });
  } catch (e) {
    warnings.push(`Supabase-каталог недоступен: ${(e as Error).message}`);
  }

  // 3. Дата конца (без shell date -d)
  const days = flags['days'] ? Number(flags['days']) : 0;
  const hours = flags['hours'] ? Number(flags['hours']) : 0;
  let rentEnd = flags['end'];
  if (!rentEnd) {
    if (days === 0 && hours === 0) die('нужен --end <ISO> ИЛИ --days N / --hours N');
    rentEnd = computeEndISO(start, days, hours);
  }

  // 4. Прайс байка: Supabase LIVE имеет приоритет → fallback на bike-prices.md → warn.
  //     definitive edition: каталог — источник правды, .md — emergency-fallback.
  let priceText: string | null = null;
  let priceSource: 'catalog' | 'md' | 'none' = 'none';
  if (catalogBike) {
    const card = extractPriceCard(catalogBike);
    if (card.source === 'catalog') {
      priceText = formatPriceCard(card);
      priceSource = 'catalog';
    }
  }
  if (priceSource !== 'catalog') {
    // Fallback на устаревший bike-prices.md (если каталог пуст/недоступен).
    const md = priceLineForSlug(bike.modelSlug ?? catalogBike?.id ?? '');
    if (md) {
      priceText = md;
      priceSource = 'md';
      warnings.push('прайс взят из bike-prices.md (каталог Supabase пуст) — обнови через catalog sync');
    } else {
      priceSource = 'none';
    }
  }
  if (priceSource === 'none') {
    warnings.push('прайс не найден — цену уточнить вручную');
  }
  if (!fields.fullName) warnings.push('не распознано ФИО — проверь паспорт');
  if (!fields.passportNumber) warnings.push('не распознан номер паспорта');

  // 5. staged-JSON в uploads (plaintext ПДн — чистится в gen-contract --staged)
  const stagedName = `staged-${Date.now()}.json`;
  const stagedPath = assertInUploads(path.join(UPLOADS_DIR, stagedName));
  const staged: StagedContract = {
    client: fields,
    bikeId: bike.id,
    makeModel: bike.makeModel,
    vin: bike.vin,
    rentStart: start,
    rentEnd,
    contractType,
    photos,
  };
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(stagedPath, JSON.stringify(staged, null, 2));
  try { fs.chmodSync(stagedPath, 0o600); } catch { /* ПДн */ }

  // 6. Карточка для оператора (бот шлёт дословно)
  const card = [
    `КЛИЕНТ`,
    `  ФИО: ${fields.fullName ?? '—'}`,
    `  Дата рождения: ${fields.birthDate ?? '—'}`,
    `  Паспорт: ${fields.passportSeries ?? ''} ${fields.passportNumber ?? ''}`.trim(),
    `  Выдан: ${fields.passportIssuedBy ?? '—'} (${fields.passportIssuedDate ?? '—'})`,
    `  Прописка: ${fields.registrationAddress ?? '—'}`,
    `  ВУ: ${fields.licenseNumber ?? '—'} кат. ${fields.licenseCategories ?? '—'}`,
    `  Телефон: ${fields.phone ?? '—'}`,
    ``,
    `БАЙК: ${bike.makeModel} (VIN: ${bike.vin ?? 'без VIN'})` +
      (catalogBike ? `  [каталог: ${catalogBike.make} ${catalogBike.model}]` : ''),
    `СРОК: с ${start} по ${rentEnd}`,
    `ТИП: ${contractType === 'sale' ? 'продажа' : 'аренда'}`,
    ``,
    `ПРАЙС (подтверди цену):`,
    priceSource === 'catalog'
      ? `  ${priceText}  [LIVE Supabase]`
      : priceSource === 'md'
      ? `  ${priceText}  [устаревший bike-prices.md]`
      : `  не найден — укажи цену вручную`,
  ].join('\n');

  process.stdout.write(JSON.stringify({
    status: 'ready',
    card,
    stagedPath,
    bike: { id: bike.id, makeModel: bike.makeModel, slug: bike.modelSlug },
    rentStart: start,
    rentEnd,
    warnings,
  }, null, 2) + '\n');
}

async function cmdGenContract(flags: Record<string, string>, rawArgs: string[] = []): Promise<void> {
  const stagedPathFlag = flags['staged'];
  let stagedFields: ClientOcrFields | null = null;
  let stagedPhotos: string[] = [];
  let stagedPathResolved: string | null = null;
  if (stagedPathFlag) {
    stagedPathResolved = assertInUploads(stagedPathFlag);
    const staged = JSON.parse(fs.readFileSync(stagedPathResolved, 'utf8')) as StagedContract;
    stagedFields = staged.client;
    stagedPhotos = staged.photos ?? [];
    // staged заполняет байк/срок/тип — бот их повторно не передаёт
    if (!flags['bike']) flags['bike'] = staged.bikeId;
    if (!flags['start']) flags['start'] = staged.rentStart;
    if (!flags['end']) flags['end'] = staged.rentEnd;
    // Валидируем тип из staged (целостность): только rental|sale, иначе rental.
    if (!flags['type']) flags['type'] = staged.contractType === 'sale' ? 'sale' : 'rental';
    // правки оператора
    applySetOverrides(stagedFields, rawArgs);
  }

  const clientJsonPath = flags['client'];
  const clientId = flags['client-id'];
  const bikeId = flags['bike'];
  const rentStart = flags['start'];
  const rentEnd = flags['end'];
  // Feature: тип договора (rental по умолчанию)
  const contractType = (flags['type'] as 'rental' | 'sale') ?? 'rental';

  if (!clientJsonPath && !clientId && !stagedFields) die('нужен --client <ocr-fields.json> ИЛИ --client-id <id> ИЛИ --staged <path>');
  if (!bikeId) die('нужен --bike <bike-id> (или --staged с байком)');

  const rateType = (flags['tariff'] as 'hour' | 'day') ?? undefined;
  const deposit = flags['deposit'] ? Number(flags['deposit']) : undefined;
  const priceHour = flags['price-hour'] ? Number(flags['price-hour']) : undefined;
  const priceDay = flags['price-day'] ? Number(flags['price-day']) : undefined;

  // Поля купли-продажи (только при --type sale)
  const salePrice = flags['price'] ? Number(flags['price']) : undefined;
  const salePriceWords = flags['price-words'] ?? undefined;
  const prepayment = flags['prepayment'] ? Number(flags['prepayment']) : undefined;
  const prepaymentWords = flags['prepayment-words'] ?? undefined;
  const warrantyMonths = flags['warranty-months'] ? Number(flags['warranty-months']) : undefined;

  // 1. Получить арендодателя и байк (до создания договора — lessorId идёт в запись)
  const lessor = getActiveLessor();
  if (!lessor) die('нет активного арендодателя в БД (добавить строку в таблицу lessor)');
  // --bike принимает UUID ИЛИ model_slug (прямой флоу: оператор знает slug из bike-prices.md, не UUID).
  let bike = getBikeUnit(bikeId);
  if (!bike) {
    const bySlug = findBikeUnitsBySlug(bikeId);
    if (bySlug.length === 1) {
      bike = bySlug[0];
    } else if (bySlug.length > 1) {
      die(`по slug "${bikeId}" несколько доступных байков (${bySlug.length}) — передай --bike <id> конкретного юнита`);
    }
  }
  if (!bike) die(`байк ${bikeId} не найден в bike_units (ни по id, ни по slug)`);
  const resolvedBikeId = bike.id;

  // 2. Клиент: ПОВТОРНЫЙ (--client-id) | НОВЫЙ из staged (prep) | НОВЫЙ из --client OCR-json
  let client;
  if (clientId) {
    client = getClient(clientId);
    if (!client) die(`клиент ${clientId} не найден (для повторного оформления)`);
  } else {
    let ocrFields: ClientOcrFields;
    if (stagedFields) {
      ocrFields = stagedFields;
    } else {
      // H2: assertInUploads защищает от path traversal до чтения файла
      const safeClientJsonPath = assertInUploads(clientJsonPath);
      ocrFields = JSON.parse(fs.readFileSync(safeClientJsonPath, 'utf8')) as ClientOcrFields;
    }
    if (!ocrFields.fullName) die('нет fullName (staged/client JSON) — распознавание не дало ФИО');
    const pdnConsent = flags['consent'] === 'true';
    client = createClient(ocrFields, pdnConsent ? { pdnConsent: true } : undefined);
  }

  // 3. Создать договор (draft) — с lessorId
  const contract = createContract({
    clientId: client.id,
    bikeUnitId: resolvedBikeId,
    lessorId: lessor.id,
    rentStart,
    rentEnd,
    rateType,
    priceHour,
    priceDay,
    deposit,
    contractType,
    salePrice,
    salePriceWords,
    prepayment,
    prepaymentWords,
    warrantyMonths,
  });

  // 4. Сгенерировать .docx
  const { buffer, sha256 } = generateContract({ contract, lessor, client, bike });

  // 5. Сохранить файл
  // M1: assertInStoreDir защищает от path traversal для --out-dir
  // N2: дефолт = STORE_DIR (учитывает CONTRACTS_STORE_DIR), не литерал 'workspace/store'
  const outDir = assertInStoreDir(flags['out-dir'] ?? STORE_DIR);
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `contract-${contract.contractNumber ?? contract.id}.docx`;
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, buffer);
  try { fs.chmodSync(outPath, 0o600); } catch { /* ПДн-договор — ограничить доступ (152-ФЗ) */ }

  // 6. Привязать к договору
  attachContractDoc(contract.id, { docxPath: outPath, sha256, status: 'active' });

  // 7. Детерминированная чистка ПДн-фото (152-ФЗ): удаляем переданные фото из uploads/.
  //    НЕ полагаемся на LLM-шаг агента. Удаляем только пути ВНУТРИ uploads/.
  const cleaned: string[] = [];
  if (flags['cleanup-files']) {
    for (const raw of flags['cleanup-files'].split(',').map((s) => s.trim()).filter(Boolean)) {
      const safe = assertInUploads(raw);
      try {
        if (fs.existsSync(safe)) {
          fs.unlinkSync(safe);
          cleaned.push(safe);
        }
      } catch (e) {
        console.error(`warn: не удалось удалить ${safe}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // MED-3: удалить OCR JSON клиента (plaintext ПДн, 152-ФЗ) — вместе с фото
  if (clientJsonPath && !clientId) {
    try {
      const safeJson = assertInUploads(clientJsonPath);
      if (fs.existsSync(safeJson)) {
        fs.unlinkSync(safeJson);
        cleaned.push(safeJson);
      }
    } catch (e) {
      console.error(`warn: не удалось удалить client.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // staged-флоу: чистим staged-JSON (plaintext ПДн) + распознанные фото (152-ФЗ)
  if (stagedPathResolved) {
    for (const f of [...stagedPhotos, stagedPathResolved]) {
      try {
        const safe = assertInUploads(f);
        if (fs.existsSync(safe)) { fs.unlinkSync(safe); cleaned.push(safe); }
      } catch (e) {
        console.error(`warn: не удалось удалить ${f}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 8. Отправка на почту (--email): генерация+письмо+чистка одной командой.
  //    Письмо уходит на служебный ящик проката + копия оператору (CC из скрипта).
  //    Не валим генерацию, если почта не настроена/не доехала — это отдельный канал.
  let emailed: 'sent' | 'skipped-no-smtp' | 'error' | null = null;
  if (flags['email']) {
    const subject = `Договор ${contract.contractNumber ?? contract.id} — ${client.fullName ?? ''}`.trim();
    const script = path.resolve('scripts', 'send-contract-email.py');
    // Тему (содержит ФИО — ПДн) передаём через env, НЕ argv: иначе ФИО видно в `ps`/cmdline (152-ФЗ).
    const res = spawnSync('python3', [script, outPath], {
      encoding: 'utf-8',
      env: { ...process.env, CONTRACT_SUBJECT: subject },
    });
    if (res.status === 0) emailed = 'sent';
    else if (res.status === 2) emailed = 'skipped-no-smtp';
    else {
      emailed = 'error';
      console.error(`warn: отправка письма не удалась: ${(res.stderr || res.stdout || '').trim()}`);
    }
  }

  process.stdout.write(
    JSON.stringify(
      { path: outPath, contractNumber: contract.contractNumber, sha256, cleaned, emailed },
      null,
      2,
    ) + '\n',
  );
}

/** Поиск сохранённого (повторного) клиента по ФИО/телефону. */
function cmdFindClient(flags: Record<string, string>): void {
  const q = flags['query'] ?? flags['q'];
  if (!q) die('нужен --query "<ФИО или телефон>"');
  const clients = findClients(q, flags['limit'] ? Number(flags['limit']) : 10);
  // Отдаём ключевые поля для подтверждения оператором (без избыточных ПДн в выводе).
  const out = clients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    birthDate: c.birthDate,
    phone: c.phone,
    passportSeries: c.passportSeries,
    passportNumber: c.passportNumber,
    licenseNumber: c.licenseNumber,
  }));
  process.stdout.write(JSON.stringify({ found: out.length, clients: out }, null, 2) + '\n');
}

/** История договоров (последние N) — для контекста по клиенту/парку. */
function cmdContracts(flags: Record<string, string>): void {
  const limit = flags['limit'] ? Number(flags['limit']) : 20;
  const all = listContracts(limit);
  const rows = all.map((c) => ({
    contractNumber: c.contractNumber,
    contractDate: c.contractDate,
    clientId: c.clientId,
    bikeUnitId: c.bikeUnitId,
    status: c.status,
    docxPath: c.docxPath,
  }));
  process.stdout.write(JSON.stringify({ count: rows.length, contracts: rows }, null, 2) + '\n');
}

function cmdMigrate(): void {
  // getDb() авто-применяет schema.sql при открытии — просто открываем
  getDb();
  console.log('migrate: schema applied (CREATE TABLE IF NOT EXISTS)');
}

// ── Catalog (Supabase) ───────────────────────────────────────────────────────
// Подкоманды: find | show | list | add-bike | add-lead
// Источник правды для прайса/specs байка (definitive edition).

async function cmdCatalogFind(flags: Record<string, string>): Promise<void> {
  const q = flags['query'] ?? flags['q'];
  if (!q) die('нужен --query "<модель/имя/VIN-фрагмент>"');
  const crew = flags['crew'] ?? defaultCrewSlug();
  const results = await findBikeInCatalog(q, crew);
  if (results.length === 0) {
    process.stdout.write(JSON.stringify({
      found: 0,
      message: `ничего не найдено в каталоге по запросу "${q}"`,
    }, null, 2) + '\n');
    return;
  }
  const out = results.map((b) => ({
    id: b.id,
    make: b.make,
    model: b.model,
    type: b.type,
    price: extractPriceCard(b),
  }));
  process.stdout.write(JSON.stringify({
    found: out.length,
    crew: crew ?? '(all)',
    bikes: out,
  }, null, 2) + '\n');
}

async function cmdCatalogShow(flags: Record<string, string>): Promise<void> {
  const id = flags['id'];
  if (!id) die('нужен --id <slug>');
  const bike = await getBikeById(id);
  if (!bike) die(`байк "${id}" не найден в каталоге`);
  process.stdout.write(JSON.stringify({
    id: bike.id,
    make: bike.make,
    model: bike.model,
    type: bike.type,
    crew_id: bike.crew_id,
    owner_id: bike.owner_id,
    specs: bike.specs,
    price: extractPriceCard(bike),
    formatted: formatBikeLine(bike),
  }, null, 2) + '\n');
}

async function cmdCatalogList(flags: Record<string, string>): Promise<void> {
  const crew = flags['crew'] ?? defaultCrewSlug();
  const bikes = await listCrewBikes(crew);
  const out = bikes.map((b) => ({
    id: b.id,
    make: b.make,
    model: b.model,
    price: extractPriceCard(b),
  }));
  process.stdout.write(JSON.stringify({
    crew: crew ?? '(all)',
    count: out.length,
    bikes: out,
  }, null, 2) + '\n');
}

/**
 * catalog add-bike:
 *   --from-catalog <id> [--sync-local]           → синк существующей записи в local
 *   --make X --model Y [--type ebike] ...        → новая запись в каталоге
 *     [+ --sync-local чтобы сразу создать local bike_unit]
 */
async function cmdCatalogAddBike(flags: Record<string, string>): Promise<void> {
  // ПУТЬ 1: --from-catalog <id> — синк существующего
  if (flags['from-catalog']) {
    const catalogId = flags['from-catalog'];
    const bike = await getBikeById(catalogId);
    if (!bike) die(`байк "${catalogId}" не найден в каталоге Supabase`);
    let localId: string | null = null;
    if (flags['sync-local']) {
      const unit = createBikeUnit({
        modelSlug: bike.id,
        makeModel: `${bike.make} ${bike.model}`.trim(),
        vin: bike.specs?.vin ?? bike.specs?.frame ?? null,
        year: bike.specs?.year ? Number(bike.specs.year) : null,
        color: bike.specs?.color ?? null,
        status: 'available',
      });
      localId = unit.id;
    }
    process.stdout.write(JSON.stringify({
      status: 'synced',
      catalog: { id: bike.id, make: bike.make, model: bike.model },
      localBikeUnitId: localId,
      hint: localId ? `prepc --bike ${localId}   или   --bike-slug ${bike.id}` : 'без --sync-local: только каталог',
    }, null, 2) + '\n');
    return;
  }

  // ПУТЬ 2: новый байк — собираем из флагов
  const make = flags['make'];
  const model = flags['model'];
  if (!make || !model) die('нужны --make и --model (или --from-catalog <id>)');
  const id = flags['id'] ?? slugify(`${make}-${model}-${flags['year'] ?? ''}`);
  const specs: Record<string, unknown> = {};
  if (flags['vin']) specs.vin = flags['vin'];
  if (flags['frame']) specs.frame = flags['frame'];
  if (flags['color']) specs.color = flags['color'];
  if (flags['year']) specs.year = Number(flags['year']);
  if (flags['price-day']) specs.rent_weekday = Number(flags['price-day']);
  if (flags['price-weekend']) specs.rent_weekend = Number(flags['price-weekend']);
  if (flags['price-hour']) specs.price_per_hour = Number(flags['price-hour']);
  if (flags['price-sale']) specs.sale_price = Number(flags['price-sale']);
  if (flags['deposit']) specs.deposit_rub = Number(flags['deposit']);
  if (flags['bike-subtype']) specs.bike_subtype = flags['bike-subtype'];

  const created = await addBikeToCatalog({
    id,
    make,
    model,
    type: flags['type'] ?? 'ebike',
    specs: specs as Parameters<typeof addBikeToCatalog>[0]['specs'],
  });

  let localId: string | null = null;
  if (flags['sync-local']) {
    const unit = createBikeUnit({
      modelSlug: created.id,
      makeModel: `${created.make} ${created.model}`.trim(),
      vin: (created.specs?.vin as string | undefined) ?? null,
      year: created.specs?.year ? Number(created.specs.year) : null,
      color: (created.specs?.color as string | undefined) ?? null,
      status: 'available',
    });
    localId = unit.id;
  }
  process.stdout.write(JSON.stringify({
    status: 'added',
    catalog: { id: created.id, make: created.make, model: created.model },
    localBikeUnitId: localId,
    price: extractPriceCard(created),
  }, null, 2) + '\n');
}

/**
 * catalog add-lead: добавить байк в лиды (franchize_intents, stage=discovered).
 * Источник: vip-bike.ru / Avito / от оператора. Не создаёт cars-запись.
 *
 * Пример:
 *   catalog add-lead --slug honda-cbr600rr-2010 --make Honda --model "CBR 600RR" \
 *     --year 2010 --price-sale 310000 --source-url "https://www.avito.ru/..." \
 *     --note "хорошее состояние, 50k пробег"
 */
async function cmdCatalogAddLead(flags: Record<string, string>): Promise<void> {
  const slug = flags['slug'];
  if (!slug) die('нужен --slug <bike-slug> (например honda-cbr600rr-2010)');
  const meta: Record<string, unknown> = { scope: 'fleet-acquisition' };
  if (flags['make']) meta.make = flags['make'];
  if (flags['model']) meta.model = flags['model'];
  if (flags['year']) meta.year = Number(flags['year']);
  if (flags['price-sale']) meta.asking_price = Number(flags['price-sale']);
  if (flags['mileage']) meta.mileage = Number(flags['mileage']);
  if (flags['note']) meta.note = flags['note'];
  if (flags['contact']) meta.contact = flags['contact'];

  const result = await addLead({
    slug,
    bikeId: flags['bike-id'] ?? null,
    sourceRoute: flags['source-url'] ?? undefined,
    contactChannel: (flags['contact-channel'] as 'operator' | 'website' | 'avito' | undefined) ?? 'operator',
    urgencyScore: flags['urgency'] ? Number(flags['urgency']) : 50,
    metadata: meta,
  });
  process.stdout.write(JSON.stringify({
    status: 'lead-added',
    id: result.id,
    slug,
    metadata: meta,
    hint: 'стадия=discovered. Квалифицируй через Supabase: UPDATE franchize_intents SET stage=...',
  }, null, 2) + '\n');
}

/**
 * catalog add-avito-lead: сохранить AVITO-лид (клиент написал по объявлению
 * VIP BIKE на Авито, оператор форварднул заявку в бот). Пишет в franchize_intents
 * с intent_type=contact_click, stage=contacted, contact_channel=avito
 * (тот же combo под CHECK-констрейнт, что и callback; channel='avito' отличает источник).
 * Дедуп по телефону за 2ч среди avito-лидов.
 *
 * Пример (поле сообщения из чата):
 *   Avito · Honda CBR 600RR · аренда
 *   Иван, +7 900 123-45-67
 *   «Хочу арендовать на эти выходные, возможно ли?»
 *
 *   catalog add-avito-lead --name "Иван" --phone "+79001234567" \
 *     --bike "Honda CBR 600RR" --url "https://www.avito.ru/dialog/..."
 */
async function cmdCatalogAddAvitoLead(flags: Record<string, string>): Promise<void> {
  const name = flags['name'] ?? '';
  const phone = flags['phone'];
  if (!phone) die('нужно хотя бы --phone <телефон>. --name/--bike/--url/--message — по возможности');
  const crewSlug = flags['slug'] ?? defaultCrewSlug() ?? 'vip-bike';
  const bikeTitle = flags['bike'] ? (flags['bike'] === 'Байк' ? null : flags['bike']) : null;
  const avitoUrl = flags['url'] ?? flags['source-url'] ?? null;
  const message = flags['message'] ?? null;

  const result = await addAvitoLead({
    crewSlug,
    name,
    phone,
    bikeTitle,
    bikeId: flags['bike-id'] ?? null,
    avitoUrl,
    message,
    dedupeHours: flags['no-dedup'] ? 0 : undefined,
  });
  process.stdout.write(JSON.stringify({
    status: result.deduped ? 'lead-deduped' : 'lead-added',
    id: result.id,
    crewSlug,
    name: name || null,
    phone,
    bikeTitle,
    avitoUrl,
    intentType: 'contact_click',
    stage: 'contacted',
    contactChannel: 'avito',
    hint: result.deduped
      ? 'уже есть avito-лид с этим телефоном за последние 2ч — дубль не создан'
      : 'записан. Квалифицируй через Supabase / morning-digest.',
  }, null, 2) + '\n');
}

/**
 * catalog add-callback-lead: сохранить CUSTOMER callback-лид (CTA с vip-bike.ru,
 * пришёл форвардом в Telegram). Пишет в franchize_intents с
 * intent_type=contact_click, stage=contacted, contact_channel=telegram_forward
 * (единственный combo под CHECK-констрейнт; сайтый callback_request/lead_captured
 * НЕ проходит констрейнт и молча падает — поэтому бот = единственный источник записей).
 * С дедупом по телефону за 2ч.
 *
 * Пример (поле сообщения из чата):
 *   📞 Новая заявка на звонок
 *   🏍 Honda CBR 600RR
 *   👤 Иван
 *   📱 +7 900 123-45-67
 *   🌐 Источник: веб-сайт
 *
 *   catalog add-callback-lead --name "Иван" --phone "+79001234567" --bike "Honda CBR 600RR"
 */
async function cmdCatalogAddCallbackLead(flags: Record<string, string>): Promise<void> {
  const name = flags['name'];
  const phone = flags['phone'];
  if (!name || !phone) die('нужны --name <имя> и --phone <телефон> (остальное опционально)');
  const crewSlug = flags['slug'] ?? defaultCrewSlug() ?? 'vip-bike';
  const bikeTitle = flags['bike'] ? (flags['bike'] === 'Байк' ? null : flags['bike']) : null;

  const result = await addCallbackLead({
    crewSlug,
    name,
    phone,
    bikeTitle,
    bikeId: flags['bike-id'] ?? null,
    sourceRoute: flags['source-url'] ?? undefined,
    dedupeHours: flags['no-dedup'] ? 0 : undefined,
  });
  process.stdout.write(JSON.stringify({
    status: result.deduped ? 'lead-deduped' : 'lead-added',
    id: result.id,
    crewSlug,
    name,
    phone,
    bikeTitle,
    intentType: 'contact_click',
    stage: 'contacted',
    contactChannel: 'telegram_forward',
    hint: result.deduped
      ? 'уже есть callback-лид с этим телефоном за последние 2ч — дубль не создан'
      : 'записан. Квалифицируй через Supabase / morning-digest.',
  }, null, 2) + '\n');
}

/** Простой slugify: lower, trim, latиница по возможности, не-буквы → '-'. */
function slugify(s: string): string {
  const map: Record<string, string> = { 'а': 'a', 'в': 'v', 'е': 'e', 'к': 'k', 'м': 'm', 'н': 'n', 'о': 'o', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'х': 'x' };
  return s.toLowerCase().trim()
    .replace(/[аваекмнорстух]/gi, (c) => map[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const [, , command, ...rest] = process.argv;
// catalog: первый позиционный аргумент после команды — подкоманда (find/show/list/...).
// parseFlags пропускает bare-слова, поэтому rest[0] остаётся подкомандой.
const subcommand = command === 'catalog' ? rest[0] : undefined;
const flagArgs = command === 'catalog' ? rest.slice(1) : rest;
const flags = parseFlags(flagArgs);

switch (command) {
  case 'recognize':
    cmdRecognize(flags).catch((e) => { console.error(e); process.exit(1); });
    break;
  case 'prep':
    cmdPrep(flags).catch((e) => { console.error(e); process.exit(1); });
    break;
  case 'gen-contract':
    cmdGenContract(flags, rest).catch((e) => { console.error(e); process.exit(1); });
    break;
  case 'find-client':
    cmdFindClient(flags);
    break;
  case 'contracts':
    cmdContracts(flags);
    break;
  case 'migrate':
    cmdMigrate();
    break;
  case 'catalog':
    switch (subcommand) {
      case 'find':
        cmdCatalogFind(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'show':
        cmdCatalogShow(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'list':
        cmdCatalogList(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'add-bike':
        cmdCatalogAddBike(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'add-lead':
        cmdCatalogAddLead(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'add-callback-lead':
        cmdCatalogAddCallbackLead(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      case 'add-avito-lead':
        cmdCatalogAddAvitoLead(flags).catch((e) => { console.error(e); process.exit(1); });
        break;
      default:
        console.error(`catalog: неизвестная подкоманда "${subcommand ?? '(нет)'}". Доступны: find | show | list | add-bike | add-lead | add-callback-lead | add-avito-lead`);
        process.exit(1);
    }
    break;
  default:
    console.error(`Неизвестная команда: ${command ?? '(нет)'}. Доступны: recognize | prep | gen-contract | find-client | contracts | catalog <find|show|list|add-bike|add-lead|add-callback-lead|add-avito-lead> | migrate`);
    process.exit(1);
}
