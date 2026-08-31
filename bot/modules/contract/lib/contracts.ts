import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import type {
  Lessor,
  Client,
  ClientOcrFields,
  BikeUnit,
  RentalContract,
} from './types.js';

// L4: статус договора по умолчанию
const DEFAULT_CONTRACT_STATUS = 'draft' as const;

// ─── Мапперы row → camelCase ─────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
const toLessor = (r: any): Lessor => ({
  id: r.id,
  entityType: r.entity_type,
  name: r.name,
  ogrn: r.ogrn,
  inn: r.inn,
  address: r.address,
  signatory: r.signatory,
  basis: r.basis,
  contacts: r.contacts,
  isActive: r.is_active === 1,
});

const toClient = (r: any): Client => ({
  id: r.id,
  entityType: r.entity_type,
  fullName: r.full_name,
  birthDate: r.birth_date,
  passportSeries: r.passport_series,
  passportNumber: r.passport_number,
  passportIssuedBy: r.passport_issued_by,
  passportIssuedDate: r.passport_issued_date,
  passportDeptCode: r.passport_dept_code,
  registrationAddress: r.registration_address,
  licenseNumber: r.license_number,
  licenseCategories: r.license_categories,
  licenseIssuedDate: r.license_issued_date,
  licenseValidUntil: r.license_valid_until,
  inn: r.inn,
  ogrn: r.ogrn,
  legalAddress: r.legal_address,
  phone: r.phone,
  telegram: r.telegram,
  docFiles: JSON.parse(r.doc_files ?? '[]'),
  rawOcr: r.raw_ocr ? (JSON.parse(r.raw_ocr) as Record<string, unknown>) : null,
  pdnConsentAt: r.pdn_consent_at,
});

const toBikeUnit = (r: any): BikeUnit => ({
  id: r.id,
  modelSlug: r.model_slug,
  makeModel: r.make_model,
  vin: r.vin,
  year: r.year,
  color: r.color,
  powerKw: r.power_kw,
  maxSpeedKmh: r.max_speed_kmh,
  battery: r.battery,
  status: r.status,
});

const toContract = (r: any): RentalContract => ({
  id: r.id,
  contractNumber: r.contract_number,
  contractDate: r.contract_date,
  city: r.city,
  lessorId: r.lessor_id,
  clientId: r.client_id,
  bikeUnitId: r.bike_unit_id,
  rentStart: r.rent_start,
  rentEnd: r.rent_end,
  returnAddress: r.return_address,
  rateType: r.rate_type,
  priceHour: r.price_hour === null ? null : Number(r.price_hour),
  priceDay: r.price_day === null ? null : Number(r.price_day),
  deposit: r.deposit === null ? null : Number(r.deposit),
  status: r.status,
  docxPath: r.docx_path,
  pdfPath: r.pdf_path,
  originalSha256: r.original_sha256,
  createdBy: r.created_by,
  rawInputs: r.raw_inputs ? (JSON.parse(r.raw_inputs) as Record<string, unknown>) : null,
  // ── contract_type + sale fields (migration 002) ───────────────────────────
  contractType: (r.contract_type ?? 'rental') as 'rental' | 'sale',
  salePrice: r.sale_price === null || r.sale_price === undefined ? null : Number(r.sale_price),
  salePriceWords: r.sale_price_words ?? null,
  prepayment: r.prepayment === null || r.prepayment === undefined ? null : Number(r.prepayment),
  prepaymentWords: r.prepayment_words ?? null,
  warrantyMonths: r.warranty_months === null || r.warranty_months === undefined ? null : Number(r.warranty_months),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Арендодатель ────────────────────────────────────────────────────────────
export function getActiveLessor(): Lessor | null {
  const row = getDb()
    .prepare(`SELECT * FROM lessor WHERE is_active = 1 ORDER BY id DESC LIMIT 1`)
    .get();
  return row ? toLessor(row) : null;
}

// ─── Клиенты ─────────────────────────────────────────────────────────────────
export function createClient(
  fields: ClientOcrFields,
  extra?: { telegram?: string; rawOcr?: Record<string, unknown>; pdnConsent?: boolean },
): Client {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO clients (
       id, entity_type, full_name, birth_date,
       passport_series, passport_number, passport_issued_by, passport_issued_date, passport_dept_code,
       registration_address, license_number, license_categories, license_issued_date, license_valid_until,
       inn, ogrn, legal_address, phone, telegram, raw_ocr, pdn_consent_at, created_at, updated_at
     ) VALUES (
       ?, COALESCE(?,'гражданин'), ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?
     )`,
  ).run(
    id,
    fields.entityType ?? null,
    fields.fullName,
    fields.birthDate ?? null,
    fields.passportSeries ?? null,
    fields.passportNumber ?? null,
    fields.passportIssuedBy ?? null,
    fields.passportIssuedDate ?? null,
    fields.passportDeptCode ?? null,
    fields.registrationAddress ?? null,
    fields.licenseNumber ?? null,
    fields.licenseCategories ?? null,
    fields.licenseIssuedDate ?? null,
    fields.licenseValidUntil ?? null,
    fields.inn ?? null,
    fields.ogrn ?? null,
    fields.legalAddress ?? null,
    fields.phone ?? null,
    extra?.telegram ?? null,
    extra?.rawOcr ? JSON.stringify(extra.rawOcr) : null,
    extra?.pdnConsent ? now : null,
    now,
    now,
  );
  const row = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  return toClient(row);
}

export function findClients(q: string, limit = 10): Client[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM clients
       WHERE lower(full_name) LIKE lower(?) OR phone LIKE ?
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(`%${q}%`, `%${q}%`, limit);
  return (rows as unknown[]).map(toClient);
}

export function getClient(id: string): Client | null {
  const row = getDb().prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
  return row ? toClient(row) : null;
}

// ─── Единицы парка ───────────────────────────────────────────────────────────
export function listBikeUnits(): BikeUnit[] {
  const rows = getDb().prepare(`SELECT * FROM bike_units ORDER BY make_model`).all();
  return (rows as unknown[]).map(toBikeUnit);
}

export function getBikeUnit(id: string): BikeUnit | null {
  const row = getDb().prepare(`SELECT * FROM bike_units WHERE id = ?`).get(id);
  return row ? toBikeUnit(row) : null;
}

export function findBikeUnitsBySlug(slug: string): BikeUnit[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM bike_units WHERE model_slug = ? AND status = 'available' ORDER BY created_at`,
    )
    .all(slug);
  return (rows as unknown[]).map(toBikeUnit);
}

/**
 * Создать локальный bike_unit (инстанс) из данных каталога Supabase.
 * Используется командой `catalog add-bike --sync-local` для связывания
 * каталог-карточки с конкретным физическим юнитом в нашем парке.
 *
 * Дедуп: если уже есть юнит с таким model_slug + VIN — возвращаем существующий.
 */
export function createBikeUnit(input: {
  modelSlug?: string | null;
  makeModel: string;
  vin?: string | null;
  year?: number | null;
  color?: string | null;
  powerKw?: string | null;
  maxSpeedKmh?: string | null;
  battery?: string | null;
  status?: 'available' | 'rented' | 'service';
}): BikeUnit {
  const db = getDb();
  // Дедуп по (model_slug, vin)
  if (input.modelSlug && input.vin) {
    const existing = db
      .prepare(
        `SELECT * FROM bike_units WHERE model_slug = ? AND vin = ? LIMIT 1`,
      )
      .get(input.modelSlug, input.vin) as Record<string, unknown> | undefined;
    if (existing) return toBikeUnit(existing);
  } else if (input.modelSlug) {
    const existing = db
      .prepare(
        `SELECT * FROM bike_units WHERE model_slug = ? AND (vin IS NULL OR vin = ?) LIMIT 1`,
      )
      .get(input.modelSlug, input.vin ?? null) as Record<string, unknown> | undefined;
    if (existing) return toBikeUnit(existing);
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO bike_units (
       id, model_slug, make_model, vin, year, color,
       power_kw, max_speed_kmh, battery, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.modelSlug ?? null,
    input.makeModel,
    input.vin ?? null,
    input.year ?? null,
    input.color ?? null,
    input.powerKw ?? null,
    input.maxSpeedKmh ?? null,
    input.battery ?? null,
    input.status ?? 'available',
    now,
  );
  const row = db.prepare(`SELECT * FROM bike_units WHERE id = ?`).get(id);
  return toBikeUnit(row);
}

/**
 * Поиск байка по свободному запросу оператора («Ducati», «нибблер», «kawasaki»).
 * Fuzzy: каждое слово запроса (lowercase) должно встретиться в make_model ИЛИ model_slug.
 * Возвращает кандидатов (0 — не найдено, 1 — точный резолв, >1 — оператор уточняет).
 */
export function findBikeUnitsByName(query: string): BikeUnit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return listBikeUnits().filter((b) => {
    const hay = `${b.makeModel ?? ''} ${b.modelSlug ?? ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// ─── Договоры ────────────────────────────────────────────────────────────────

/**
 * Следующий № договора в формате VB-YYYY-NNN.
 * H1 fix: используем MAX seq из contract_number, не COUNT(*) —
 * COUNT ломается при отменённых/удалённых договорах (коллизии номеров).
 * Нумерация сквозная (rental + sale) — единый ряд VB-.
 */
export function nextContractNumber(year: number): string {
  const row = getDb()
    .prepare(
      `SELECT MAX(CAST(substr(contract_number, 9) AS INTEGER)) as max_seq
         FROM rental_contracts
        WHERE contract_number LIKE ?`,
    )
    .get(`VB-${year}-%`) as { max_seq: number | null };
  const seq = (row?.max_seq ?? 0) + 1;
  return `VB-${year}-${String(seq).padStart(3, '0')}`;
}

export interface CreateContractInput {
  clientId: string;
  bikeUnitId: string;
  lessorId?: number;
  rentStart?: string;
  rentEnd?: string;
  returnAddress?: string;
  rateType?: 'hour' | 'day';
  priceHour?: number;
  priceDay?: number;
  deposit?: number;
  createdBy?: string;
  rawInputs?: Record<string, unknown>;
  // ── Тип договора + поля продажи ───────────────────────────────────────────
  contractType?: 'rental' | 'sale';
  salePrice?: number;
  salePriceWords?: string;
  prepayment?: number;
  prepaymentWords?: string;
  warrantyMonths?: number;
}

export function createContract(input: CreateContractInput): RentalContract {
  const db = getDb();
  const year = new Date().getFullYear();
  const number = nextContractNumber(year);
  const id = randomUUID();
  const now = new Date().toISOString();
  const contractDate = now.slice(0, 10); // YYYY-MM-DD
  db.prepare(
    `INSERT INTO rental_contracts (
       id, contract_number, contract_date, lessor_id, client_id, bike_unit_id,
       rent_start, rent_end, return_address,
       rate_type, price_hour, price_day, deposit,
       status, created_by, raw_inputs,
       contract_type, sale_price, sale_price_words, prepayment, prepayment_words, warranty_months,
       created_at, updated_at
     ) VALUES (
       ?, ?, ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?,
       ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?
     )`,
  ).run(
    id,
    number,
    contractDate,
    input.lessorId ?? null,
    input.clientId,
    input.bikeUnitId,
    input.rentStart ?? null,
    input.rentEnd ?? null,
    input.returnAddress ?? null,
    input.rateType ?? null,
    input.priceHour ?? null,
    input.priceDay ?? null,
    input.deposit ?? null,
    DEFAULT_CONTRACT_STATUS,
    input.createdBy ?? null,
    input.rawInputs ? JSON.stringify(input.rawInputs) : null,
    input.contractType ?? 'rental',
    input.salePrice ?? null,
    input.salePriceWords ?? null,
    input.prepayment ?? null,
    input.prepaymentWords ?? null,
    input.warrantyMonths ?? null,
    now,
    now,
  );
  const row = db.prepare(`SELECT * FROM rental_contracts WHERE id = ?`).get(id);
  return toContract(row);
}

export function attachContractDoc(
  id: string,
  doc: { docxPath?: string; pdfPath?: string; sha256?: string; status?: RentalContract['status'] },
): RentalContract | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE rental_contracts
        SET docx_path        = COALESCE(?, docx_path),
            pdf_path         = COALESCE(?, pdf_path),
            original_sha256  = COALESCE(?, original_sha256),
            status           = COALESCE(?, status),
            updated_at       = ?
      WHERE id = ?`,
  ).run(
    doc.docxPath ?? null,
    doc.pdfPath ?? null,
    doc.sha256 ?? null,
    doc.status ?? null,
    now,
    id,
  );
  const row = db.prepare(`SELECT * FROM rental_contracts WHERE id = ?`).get(id);
  return row ? toContract(row) : null;
}

export function getContract(id: string): RentalContract | null {
  const row = getDb().prepare(`SELECT * FROM rental_contracts WHERE id = ?`).get(id);
  return row ? toContract(row) : null;
}

export function listContracts(limit = 50): RentalContract[] {
  const rows = getDb()
    .prepare(`SELECT * FROM rental_contracts ORDER BY created_at DESC LIMIT ?`)
    .all(limit);
  return (rows as unknown[]).map(toContract);
}
