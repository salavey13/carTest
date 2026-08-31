/**
 * modules/contract/lib/supabase.ts
 * ====================================================================
 * Read/write слой к каталогу байков и лидам в Supabase.
 *
 * Цель: заменить статичный workspace/reference/bike-prices.md на LIVE-данные
 * из таблицы `cars` (каталог байков с specs/prices) и писать новые лиды в
 * `franchize_intents` (для последующей квалификации).
 *
 * Архитектура (definitive edition):
 *   - Каталог (Supabase cars) → модель/прайс/specs (источник правды для цены)
 *   - Инстансы (local SQLite bike_units) → конкретные VIN/статус (для FK в договорах)
 *   - Лиды (Supabase franchize_intents) → потенциальные байки с vip-bike.ru/Avito
 *
 * Mirror: app/webhook-handlers/commands/doc-manual.ts (resolveBikeById,
 * getCrewBikes, getAllBikes, buildPriceKeyboard) — паттерны фуззи-матчинга и
 * crew-фильтрации перенесены сюда 1-в-1.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// Node 20 не имеет нативного WebSocket — supabase-js v2 требует его для Realtime.
// Мы Realtime не используем (только REST/PostgREST), но конструктор всё равно
// инстанцирует RealtimeClient. Подкладываем ws как transport.
import ws from 'ws';

// ── Типы каталога (mirror cars.* колонок) ────────────────────────────────────

/** specs-JSON из cars.specs (ключи, которые нам нужны). Прочие ключи игнорируем. */
export interface BikeSpecs {
  vin?: string;
  frame?: string;
  color?: string;
  year?: number | string;
  sale_price?: number;
  deposit_rub?: number;
  rent_weekday?: number;
  rent_weekend?: number;
  price_per_hour?: number;
  hourlyPrice?: number;
  dailyPrice?: number;
  sale?: boolean;
  bike_subtype?: string;
  motor_type?: string;
  motor_power?: string;
  battery?: string;
  range_km?: number;
  // прочие поля (colorOptions, images, ...) проходят как Record<string, unknown>
  [key: string]: unknown;
}

/** Одна запись из cars (часть колонок — только то, что SELECT'им). */
export interface CatalogBike {
  id: string;
  make: string;
  model: string;
  type: string; // 'bike' | 'ebike' | 'car' (we filter to bike|ebike)
  crew_id: string | null;
  owner_id: string | null;
  specs: BikeSpecs;
}

/** Извлечённая карточка цен для operуатора (показ в чат). */
export interface BikePriceCard {
  rentWeekday: number | null;
  rentWeekend: number | null;
  hourly: number | null;
  salePrice: number | null;
  depositRub: number | null;
  /** Источник цены (для отладки/честности). */
  source: 'catalog' | 'fallback';
}

// ── Singleton клиент ─────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы в .env. ' +
      'Скопируй из /opt/vip-bike-rental/.env.local.',
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as WebSocket },
  });
  return _client;
}

/** Crew slug по умолчанию из env (для фильтрации «нашего» парка). */
export function defaultCrewSlug(): string | undefined {
  const slug = process.env.SUPABASE_CREW_SLUG;
  return slug && slug.trim() ? slug.trim() : undefined;
}

// ── Crew resolution ──────────────────────────────────────────────────────────

const CREW_CACHE: Map<string, string> = new Map();

async function resolveCrewId(crewSlug: string): Promise<string | null> {
  if (CREW_CACHE.has(crewSlug)) return CREW_CACHE.get(crewSlug)!;
  const { data, error } = await getSupabaseClient()
    .from('crews')
    .select('id')
    .eq('slug', crewSlug)
    .maybeSingle();
  if (error) {
    throw new Error(`resolveCrewId(${crewSlug}): ${error.message}`);
  }
  const id = data?.id ?? null;
  if (id) CREW_CACHE.set(crewSlug, id);
  return id;
}

// ── SELECT-хелпер ────────────────────────────────────────────────────────────

const BIKE_TYPES = ['bike', 'ebike'];
const BIKE_COLUMNS = 'id, make, model, type, crew_id, owner_id, specs';

// ── READ: list / find / get ──────────────────────────────────────────────────

/** Все байки (без crew-фильтра) — fallback для админа/ой federation. */
export async function listAllBikes(): Promise<CatalogBike[]> {
  const { data, error } = await getSupabaseClient()
    .from('cars')
    .select(BIKE_COLUMNS)
    .in('type', BIKE_TYPES)
    .order('make');
  if (error) throw new Error(`listAllBikes: ${error.message}`);
  return (data ?? []) as CatalogBike[];
}

/**
 * Байки, доступные конкретному crew (включая те, что без crew_id — общие).
 * Если crewSlug не указан — возвращает все байки (fallback).
 * Mirror: getCrewBikes() из crew-access.ts.
 */
export async function listCrewBikes(crewSlug?: string): Promise<CatalogBike[]> {
  if (!crewSlug) return listAllBikes();
  const crewId = await resolveCrewId(crewSlug);
  if (!crewId) {
    // Crew не найден — не падать, отдать весь каталог (для диагностики).
    return listAllBikes();
  }
  const { data, error } = await getSupabaseClient()
    .from('cars')
    .select(BIKE_COLUMNS)
    .in('type', BIKE_TYPES)
    .or(`crew_id.eq.${crewId},crew_id.is.null`)
    .order('make');
  if (error) throw new Error(`listCrewBikes(${crewSlug}): ${error.message}`);
  return (data ?? []) as CatalogBike[];
}

/** Точное получение по id (или null). */
export async function getBikeById(id: string): Promise<CatalogBike | null> {
  const { data, error } = await getSupabaseClient()
    .from('cars')
    .select(BIKE_COLUMNS)
    .eq('id', id)
    .in('type', BIKE_TYPES)
    .maybeSingle();
  if (error) throw new Error(`getBikeById(${id}): ${error.message}`);
  return (data as CatalogBike) ?? null;
}

/**
 * Fuzzy-поиск по каталогу. Mirror: resolveBikeById() из doc-manual.ts.
 *
 * Алгоритм:
 *   1. Нормализуем запрос и поля байка (lowercase, только буквы/цифры).
 *   2. Если в haystack (id+make+model+vin+frame) содержится весь запрос целиком → top-tier.
 *   3. Иначе каждое слово запроса добавляет очки (20 + длина), если оно есть в haystack.
 *   4. Сортируем: точные совпадения первыми, потом по score.
 *
 * Возвращает до 10 кандидатов.
 */
export async function findBikeInCatalog(
  query: string,
  crewSlug?: string,
): Promise<CatalogBike[]> {
  const bikes = await listCrewBikes(crewSlug);
  if (bikes.length === 0) return [];

  const norm = (v: unknown = '') =>
    String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  const qn = norm(query);
  if (!qn) return [];

  const exact: CatalogBike[] = [];
  const scored: Array<{ bike: CatalogBike; score: number }> = [];

  for (const bike of bikes) {
    const hayParts = [
      bike.id,
      bike.make,
      bike.model,
      bike.specs?.vin,
      bike.specs?.frame,
    ];
    const hay = hayParts.map(norm).join(' ');
    if (hay.includes(qn)) {
      exact.push(bike);
      continue;
    }
    const parts = qn.split(' ').filter(Boolean);
    let score = 0;
    for (const p of parts) {
      if (p && hay.includes(p)) score += 20 + p.length;
    }
    if (score > 0) scored.push({ bike, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return [...exact, ...scored.map((s) => s.bike)].slice(0, 10);
}

// ── Prices extraction ────────────────────────────────────────────────────────

/**
 * Извлечь прайс-карточку из bikes.specs.
 * Гибкая по имени полей (rent_weekday ИЛИ dailyPrice ИЛИ price_per_hour —
 * в каталоге есть разные схемы именования).
 */
export function extractPriceCard(bike: CatalogBike): BikePriceCard {
  const s = bike.specs ?? {};
  const num = (v: unknown): number | null =>
    typeof v === 'number' && !isNaN(v) ? v
    : typeof v === 'string' && v.trim() && !isNaN(Number(v)) ? Number(v)
    : null;

  const rentWeekday = num(s.rent_weekday);
  const rentWeekend = num(s.rent_weekend);
  const hourly = num(s.price_per_hour) ?? num(s.hourlyPrice);
  const salePrice = num(s.sale_price);
  const depositRub = num(s.deposit_rub);

  const hasAny = rentWeekday !== null || rentWeekend !== null
    || hourly !== null || salePrice !== null || depositRub !== null;

  return {
    rentWeekday,
    rentWeekend,
    hourly,
    salePrice,
    depositRub,
    source: hasAny ? 'catalog' : 'fallback',
  };
}

/** Человекочитаемая прайс-строка для prep/карточки. */
export function formatPriceCard(card: BikePriceCard): string {
  if (card.source === 'fallback') {
    return 'прайс не найден в каталоге — цену уточнить вручную';
  }
  const parts: string[] = [];
  if (card.rentWeekday !== null) parts.push(`будни ${card.rentWeekday}₽/сут`);
  if (card.rentWeekend !== null) parts.push(`выходные ${card.rentWeekend}₽/сут`);
  if (card.hourly !== null) parts.push(`${card.hourly}₽/час`);
  if (card.salePrice !== null) parts.push(`продажа ${card.salePrice.toLocaleString('ru-RU')}₽`);
  if (card.depositRub !== null) parts.push(`депозит ${card.depositRub.toLocaleString('ru-RU')}₽`);
  return parts.length ? parts.join(' · ') : 'прайс пустой';
}

// ── WRITE: catalog + lead ────────────────────────────────────────────────────

export interface NewCatalogBikeInput {
  id: string;            // slug: "honda-cbr600rr-2010"
  make: string;
  model: string;
  type?: string;         // default 'ebike'
  crewId?: string | null;
  ownerId?: string | null;
  specs: BikeSpecs;
  description?: string;  // default `${make} ${model}`
}

/**
 * Добавить байк в каталог (cars).
 * Заполняет NOT NULL-колонки из init.sql: description, daily_price, image_url, rent_link.
 */
export async function addBikeToCatalog(
  input: NewCatalogBikeInput,
): Promise<CatalogBike> {
  const sb = getSupabaseClient();
  const row = {
    id: input.id,
    make: input.make,
    model: input.model,
    type: input.type ?? 'ebike',
    description: input.description ?? `${input.make} ${input.model}`,
    daily_price: input.specs.rent_weekday ?? input.specs.sale_price ?? 0,
    image_url: '',
    rent_link: '',
    is_test_result: false,
    specs: input.specs,
    crew_id: input.crewId ?? null,
    owner_id: input.ownerId ?? null,
  };
  const { data, error } = await sb
    .from('cars')
    .insert(row)
    .select(BIKE_COLUMNS)
    .single();
  if (error) {
    throw new Error(`addBikeToCatalog(${input.id}): ${error.message}`);
  }
  return data as CatalogBike;
}

export interface NewLeadInput {
  slug: string;                              // crew slug (напр. 'vip-bike') или bike slug
  bikeId?: string | null;                    // если лид на существующий cars.id
  sourceRoute?: string;                      // URL Avito / путь форварда
  contactChannel?: 'telegram' | 'phone' | 'avito' | 'website' | 'operator' | 'telegram_forward' | string;
  intentType?: string;                       // default 'prebuy'
  stage?: string;                            // default 'discovered'
  telegramUserId?: string;
  phone?: string;
  urgencyScore?: number;                     // 0-100, default 50
  metadata: Record<string, unknown>;         // детали (make/model/year/price/и т.д.)
}

/**
 * Занести лид во franchize_intents.
 * По умолчанию intent_type='prebuy', stage='discovered' — оператор видел байк
 * (на Авито/у владельца), присматривает, ещё не купил. Аналог «wishlist» для парка.
 *
 * Передай intentType/stage явно, чтобы записать другой тип лида
 * (см. addCallbackLead — для CTA-заявок клиентов с vip-bike.ru).
 */
export async function addLead(input: NewLeadInput): Promise<{ id: string }> {
  const payload = {
    slug: input.slug,
    bike_id: input.bikeId ?? null,
    intent_type: input.intentType ?? 'prebuy',
    stage: input.stage ?? 'discovered',
    source_route: input.sourceRoute ?? null,
    contact_channel: input.contactChannel ?? null,
    telegram_user_id: input.telegramUserId ?? null,
    phone: input.phone ?? null,
    urgency_score: Math.max(0, Math.min(100, input.urgencyScore ?? 50)),
    metadata: input.metadata,
  };
  const { data, error } = await getSupabaseClient()
    .from('franchize_intents')
    .insert(payload)
    .select('id')
    .single();
  if (error) {
    throw new Error(`addLead(${input.slug}): ${error.message}`);
  }
  return { id: data.id as string };
}

// ── Customer callback leads (CTA «перезвоните мне» с vip-bike.ru) ─────────────

export interface CallbackLeadInput {
  crewSlug: string;                 // 'vip-bike'
  name: string;                     // из строки «👤 <Имя>»
  phone: string;                    // из строки «📱 <телефон>»
  bikeTitle?: string | null;        // из строки «🏍 <байк>» (null если «Байк»)
  bikeId?: string | null;           // если удалось сопоставить bikeTitle с cars.id
  sourceRoute?: string;             // default '/telegram/cta-forward'
  metadata?: Record<string, unknown>;
  /** Окно дедупликации в часах (default 2). 0 → выключить дедуп. */
  dedupeHours?: number;
}

/**
 * Занести CUSTOMER callback-лид (CTA с vip-bike.ru, пришёл форвардом в Telegram).
 *
 * Semantics: intent_type='contact_click', stage='contacted' — клиент оставил
 * заявку «перезвоните мне» (контакт установлен, ждёт звонка). Это единственный
 * combo из разрешённых CHECK-констрейнтом, который подходит под CTA-форму.
 *
 * ВАЖНО про сайт: роут /api/franchize/callback-lead/route.ts шлёт
 * intent_type='callback_request', stage='lead_captured' — НИ ТО НИ ДРУГОЕ не входит
 * в franchize_intents_intent_type_allowed / _stage_allowed → сайтый insert МОЛЧА
 * падает на констрейнте (warn в лог). Поэтому сайт эти лиды НЕ сохраняет, и роль
 * бота — единственный надёжный источник записей. (Сайт шлёт только forward-telegram.)
 *
 * contact_channel='telegram_forward' — отличаем от сайтовой задуманной 'web_callback'
 * и от UI-клика кнопки 'telegram_bot'.
 *
 * Дедупликация: если за последние `dedupeHours` (default 2ч) уже есть callback-лид
 * с тем же телефоном — НЕ создаём новый, возвращаем существующий id. Ловит и по
 * phone, и по telegram_user_id (или-фильтром). Защищает от дублей при двойном
 * форварде сообщения.
 */
export async function addCallbackLead(
  input: CallbackLeadInput,
): Promise<{ id: string; deduped: boolean }> {
  const sb = getSupabaseClient();
  const hours = Math.max(0, input.dedupeHours ?? 2);
  const phone = input.phone.replace(/[^\d+]/g, '');

  // 1) Дедупликация по телефону за последние N часов (только реальные callback-лиды)
  if (phone && hours > 0) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data: existing, error } = await sb
      .from('franchize_intents')
      .select('id')
      .eq('intent_type', 'contact_click')
      .eq('stage', 'contacted')
      .or(`phone.eq.${phone},telegram_user_id.eq.${phone}`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && existing?.id) {
      return { id: existing.id as string, deduped: true };
    }
    // при ошибке дедупа — не падать, идём в insert
  }

  // 2) Insert
  const { data, error } = await sb
    .from('franchize_intents')
    .insert({
      slug: input.crewSlug,
      bike_id: input.bikeId ?? null,
      intent_type: 'contact_click',
      stage: 'contacted',
      source_route: input.sourceRoute ?? '/telegram/cta-forward',
      contact_channel: 'telegram_forward',
      telegram_user_id: phone || null,
      phone: phone || null,
      urgency_score: 60,
      metadata: {
        name: input.name,
        phone,
        bikeTitle: input.bikeTitle ?? null,
        capturedBy: 'vip-bike-assistant',
        receivedAt: new Date().toISOString(),
        ...(input.metadata ?? {}),
      },
    })
    .select('id')
    .single();
  if (error) {
    throw new Error(`addCallbackLead(${phone}): ${error.message}`);
  }
  return { id: data.id as string, deduped: false };
}

// ── Avito lead (форвард оператором) ───────────────────────────────────────────

export interface AvitoLeadInput {
  crewSlug: string;                 // 'vip-bike'
  name: string;                     // из заявки Авито (если есть)
  phone: string;                    // из заявки Авито
  bikeTitle?: string | null;        // на какой байк спрос (если распознано)
  bikeId?: string | null;           // если удалось сопоставить bikeTitle с cars.id
  avitoUrl?: string | null;         // ссылка на переписку/объявление Авито
  message?: string | null;          // тело сообщения клиента (обрезается до ~500 символов)
  metadata?: Record<string, unknown>;
  /** Окно дедупликации в часах (default 2). 0 → выключить дедуп. */
  dedupeHours?: number;
}

/**
 * Занести AVITO-лид (клиент написал в чат Авito по объявлению VIP BIKE,
 * оператор форварднул сообщение в бот).
 *
 * Semantics: тот же combo под CHECK-констрейнт, что и callback:
 *   intent_type='contact_click', stage='contacted' — клиент инициировал контакт.
 * Отличаем от CTA сайта через contact_channel='avito'.
 *
 * Дедупликация по телефону за `dedupeHours` (default 2ч) среди Avito-лидов:
 * защищает от двойного форварда одного и того же сообщения.
 */
export async function addAvitoLead(
  input: AvitoLeadInput,
): Promise<{ id: string; deduped: boolean }> {
  const sb = getSupabaseClient();
  const hours = Math.max(0, input.dedupeHours ?? 2);
  const phone = input.phone.replace(/[^\d+]/g, '');

  if (phone && hours > 0) {
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const { data: existing, error } = await sb
      .from('franchize_intents')
      .select('id')
      .eq('intent_type', 'contact_click')
      .eq('stage', 'contacted')
      .eq('contact_channel', 'avito')
      .or(`phone.eq.${phone},telegram_user_id.eq.${phone}`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && existing?.id) {
      return { id: existing.id as string, deduped: true };
    }
  }

  const message = input.message
    ? input.message.length > 500
      ? `${input.message.slice(0, 497)}...`
      : input.message
    : null;

  const { data, error } = await sb
    .from('franchize_intents')
    .insert({
      slug: input.crewSlug,
      bike_id: input.bikeId ?? null,
      intent_type: 'contact_click',
      stage: 'contacted',
      source_route: input.avitoUrl ?? '/avito/forward',
      contact_channel: 'avito',
      telegram_user_id: phone || null,
      phone: phone || null,
      urgency_score: 55,
      metadata: {
        name: input.name,
        phone,
        bikeTitle: input.bikeTitle ?? null,
        avitoUrl: input.avitoUrl ?? null,
        message,
        capturedBy: 'vip-bike-assistant',
        receivedAt: new Date().toISOString(),
        ...(input.metadata ?? {}),
      },
    })
    .select('id')
    .single();
  if (error) {
    throw new Error(`addAvitoLead(${phone}): ${error.message}`);
  }
  return { id: data.id as string, deduped: false };
}

// ── Форматирование карточки байка для prep ──────────────────────────────────

/**
 * Карточка байка одной строкой для prep-вывода.
 * Пример:
 *   Ducati Panigale S Electro (ducati-panigale-s-electro)
 *     будни 10000₽/сут · выходные 12000₽/сут · 3000₽/час · депозит 20 000₽
 */
export function formatBikeLine(bike: CatalogBike): string {
  const card = extractPriceCard(bike);
  const price = formatPriceCard(card);
  const header = `${bike.make} ${bike.model} (${bike.id})`.trim();
  return price ? `${header}\n  ${price}` : header;
}

// ── Slug lookup + local-bike enrichment ─────────────────────────────────────

/**
 * Найти байк в каталоге по точному slug (cars.id).
 * Если по id не найдено — пробует fuzzy по slug как поисковому запросу
 * и возвращает первый результат (или null).
 */
export async function getBikeBySlug(
  slug: string,
  crewSlug?: string,
): Promise<CatalogBike | null> {
  // 1) точное совпадение по id
  const exact = await getBikeById(slug);
  if (exact) return exact;
  // 2) fuzzy fallback
  const found = await findBikeInCatalog(slug, crewSlug);
  return found.length > 0 ? found[0] : null;
}

/** Минимальный профиль локального bike_unit (без ПДн — только то, что нужно для match). */
export interface LocalBikeProfile {
  modelSlug: string | null;
  makeModel: string;
  vin: string | null;
  year: number | null;
  color: string | null;
}

/**
 * Обогатить локальный bike_unit каталог-данными из Supabase.
 *
 * Mirror паттерна из doc-manual.ts: локальный юнит — это конкретная физ. единица
 * с VIN/статусом, каталог — модель с прайсом/specs. Связь по model_slug.
 *
 * Стратегия:
 *   1. Если у локального байка есть modelSlug → ищем в каталоге по нему.
 *   2. Если нет slug → ищем по makeModel (fuzzy).
 *   3. Если и это не сработало → null (Supabase недоступен или байка там нет).
 *
 * Возвращает каталог-карточку (с прайсом/specs) или null. НЕ мутирует локальный байк.
 */
export async function enrichLocalBikeFromCatalog(
  local: LocalBikeProfile,
  crewSlug?: string,
): Promise<CatalogBike | null> {
  const crew = crewSlug ?? defaultCrewSlug();
  if (local.modelSlug) {
    const bySlug = await getBikeBySlug(local.modelSlug, crew);
    if (bySlug) return bySlug;
  }
  if (local.makeModel) {
    const found = await findBikeInCatalog(local.makeModel, crew);
    if (found.length > 0) return found[0];
  }
  return null;
}
