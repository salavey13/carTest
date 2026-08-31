// ТРЕК A — бот договоров (SQLite, vip-bot)
// Только типы аренды. Источник: db/schema.sql.

/** Арендодатель (наша сторона) — реквизиты для шапки договора. */
export interface Lessor {
  id: number;
  entityType: 'ИП' | 'ООО';
  name: string;
  ogrn: string | null;
  inn: string | null;
  address: string | null;
  signatory: string | null;
  basis: string | null;
  contacts: string | null;
  isActive: boolean;
}

/** Клиент (Арендатор) — результат распознавания паспорта/прав через Z.AI vision. */
export interface Client {
  id: string;
  entityType: 'гражданин' | 'ИП' | 'ООО';
  fullName: string;
  birthDate: string | null;
  passportSeries: string | null;
  passportNumber: string | null;
  passportIssuedBy: string | null;
  passportIssuedDate: string | null;
  passportDeptCode: string | null;
  registrationAddress: string | null;
  licenseNumber: string | null;
  licenseCategories: string | null;
  licenseIssuedDate: string | null;
  licenseValidUntil: string | null;
  inn: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  phone: string | null;
  telegram: string | null;
  docFiles: { kind: 'passport' | 'license'; path?: string; url?: string; sha256?: string }[];
  rawOcr: Record<string, unknown> | null;
  pdnConsentAt: string | null;
}

/** Поля, извлекаемые Z.AI vision из фото документов (вход для createClient). */
export type ClientOcrFields = Partial<
  Omit<Client, 'id' | 'docFiles' | 'rawOcr' | 'pdnConsentAt'>
> & { fullName: string };

/** Единица парка (конкретное ТС). */
export interface BikeUnit {
  id: string;
  modelSlug: string | null;
  makeModel: string;
  vin: string | null;
  year: number | null;
  color: string | null;
  powerKw: string | null;
  maxSpeedKmh: string | null;
  battery: string | null;
  status: 'available' | 'rented' | 'service';
}

/** Договор аренды или купли-продажи. */
export interface RentalContract {
  id: string;
  contractNumber: string | null;
  contractDate: string;
  city: string;
  lessorId: number | null;
  clientId: string | null;
  bikeUnitId: string | null;
  rentStart: string | null;
  rentEnd: string | null;
  returnAddress: string | null;
  rateType: 'hour' | 'day' | null;
  priceHour: number | null;
  priceDay: number | null;
  deposit: number | null;
  status: 'draft' | 'active' | 'closed' | 'cancelled';
  docxPath: string | null;
  pdfPath: string | null;
  originalSha256: string | null;
  createdBy: string | null;
  rawInputs: Record<string, unknown> | null;
  // ── Тип договора (rental = аренда, sale = купля-продажа) ──────────────────
  contractType: 'rental' | 'sale';
  // ── Поля договора купли-продажи (null для аренды) ─────────────────────────
  salePrice: number | null;
  salePriceWords: string | null;
  prepayment: number | null;
  prepaymentWords: string | null;
  warrantyMonths: number | null;
}
