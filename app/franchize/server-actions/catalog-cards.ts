"use server";

// app/franchize/server-actions/catalog-cards.ts
// ─────────────────────────────────────────────────────────────────────────────
// БЫСТРАЯ админка промо-карточек главной витрины (boss request 2026-10-11):
// промо-модули каталога (CatalogClient → promoModules) гидратируются из
// crews.metadata.franchize.catalog.promoBanners + adCards. Раньше их правка
// жила только в большой форме конфига — теперь owner/co_owner/admin правит
// их прямо с главной страницы (CatalogCardsQuickAdmin).
//
// Доступ: платформенный admin | owner экипажа | активный член экипажа с ролью
// owner / co_owner / admin (именно тройка ролей, как просил boss; шире, чем
// resolveFranchizeEditorAccess, который знает только owner).
//
// Запись: read-modify-write crews.metadata (сохраняем все соседние ключи),
// конкурентные правки разных полей метадаты могут перетереть друг друга —
// осознанный трейд-офф для low-traffic админ-панели (как и весь config flow).
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";
import { normalizeCrewSlug } from "@/app/franchize/lib/franchize-config-contract";
import { safeCardHref } from "@/app/franchize/lib/catalog-cards-shared";
import { isGlobalAdminRow } from "@/app/franchize/lib/wall-access";
import { resolveServerActorUserId } from "@/app/franchize/server-actions/shared/auth-helpers";

// ── контракты строк (зеркало гидрации в actions-runtime.ts:996) ─────────────

export type CatalogPromoBannerRow = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  href: string;
  imageUrl: string;
  activeFrom: string;
  activeTo: string;
  priority: number;
  ctaLabel: string;
  discountType: string; // "" | "percent" | "fixed"
  discountValue: number;
  maxDiscount: number;
  minSubtotal: number;
};

export type CatalogAdCardRow = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl: string;
  badge: string;
  activeFrom: string;
  activeTo: string;
  priority: number;
  ctaLabel: string;
};

const CAP_CARD_COUNT = 12;
const CAP_TEXT = 200;
const CAP_URL = 400;

const rowBaseSchema = {
  id: z.string().trim().max(64).optional(),
  title: z.string().trim().max(CAP_TEXT).default(""),
  subtitle: z.string().trim().max(CAP_TEXT).default(""),
  href: z.string().trim().max(CAP_URL).default(""),
  imageUrl: z.string().trim().max(CAP_URL).default(""),
  activeFrom: z.string().trim().max(32).default(""),
  activeTo: z.string().trim().max(32).default(""),
  priority: z.number().finite().min(0).max(999).default(50),
  ctaLabel: z.string().trim().max(64).default(""),
};

const promoBannerSchema = z.object({
  ...rowBaseSchema,
  code: z.string().trim().max(64).default(""),
  discountType: z.enum(["", "percent", "fixed"]).default(""),
  discountValue: z.number().finite().min(0).max(100000).default(0),
  maxDiscount: z.number().finite().min(0).max(100000).default(0),
  minSubtotal: z.number().finite().min(0).max(1000000).default(0),
});

const adCardSchema = z.object({ ...rowBaseSchema, badge: z.string().trim().max(64).default("") });

const saveCatalogCardsSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  /** Подписанная Telegram-личность вызывающего (HMAC initData) или cookie.
   *  SA-002 hardening (boss round 2): id из клиентского состояния НЕ трастим. */
  initData: z.string().trim().max(8192).optional(),
  claimedActorUserId: z.string().trim().max(64).optional(),
  promoBanners: z.array(promoBannerSchema).max(CAP_CARD_COUNT),
  adCards: z.array(adCardSchema).max(CAP_CARD_COUNT),
});

export type CatalogCardsAccess = { ok: true } | { ok: false; error: string };

/**
 * Роль-гейт быстрой админки: платформенный admin, owner экипажа или активный
 * член экипажа с ролью owner / co_owner / admin. Сервер перепроверяет ВСЕГДА
 * (клиентская видимость вкладки — только UX).
 */
export async function resolveFranchizePromoCardsAccess(
  actorUserId: string | undefined,
  crew: { id: string; owner_id?: string | null },
): Promise<boolean> {
  if (!actorUserId) return false;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (isGlobalAdminRow(user ?? null)) return true;

  if (crew.owner_id && crew.owner_id === actorUserId) return true;

  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .maybeSingle();
  return (
    membership?.membership_status === "active"
    && ["owner", "co_owner", "admin"].includes(String(membership?.role ?? ""))
  );
}

function cleanText(value: unknown, cap = CAP_TEXT): string {
  return String(value ?? "").trim().slice(0, cap);
}

function cleanNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

// safeCardHref переехал в lib/catalog-cards-shared.ts (PURE): он нужен и на
// записи (этот файл), и на гидрации (actions-runtime.ts), а "use server"
// файл не имеет права экспортировать синхронные функции (build error).
// ── load ─────────────────────────────────────────────────────────────────────

export type LoadCatalogCardsResult =
  | { ok: true; canEdit: boolean; promoBanners: CatalogPromoBannerRow[]; adCards: CatalogAdCardRow[] }
  | { ok: false; error: string };

export async function loadFranchizeCatalogCardsAction(input: {
  slug: string;
  initData?: string;
  claimedActorUserId?: string;
}): Promise<LoadCatalogCardsResult> {
  const slug = normalizeCrewSlug(String(input?.slug ?? ""));
  if (!slug) return { ok: false, error: "Некорректный запрос." };

  // SA-002 hardening: личность resolving СЕРВЕРОМ (cookie или HMAC-initData).
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: input?.claimedActorUserId,
    initData: input?.initData,
  });
  if (!actorUserId) return { ok: false, error: "Карточки доступны только авторизованным в Telegram-боте экипажа." };

  const { data: crew, error } = await supabaseAdmin
    .from("crews")
    .select("id, slug, owner_id, metadata")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !crew) return { ok: false, error: "Экипаж не найден." };

  const canEdit = await resolveFranchizePromoCardsAccess(actorUserId, crew as { id: string; owner_id?: string | null });

  const metadata = (crew.metadata && typeof crew.metadata === "object" ? crew.metadata : {}) as Record<string, unknown>;
  const franchize = (metadata.franchize && typeof metadata.franchize === "object" ? metadata.franchize : {}) as Record<string, unknown>;
  const catalog = (franchize.catalog && typeof franchize.catalog === "object" ? franchize.catalog : {}) as Record<string, unknown>;

  const promoBanners: CatalogPromoBannerRow[] = (Array.isArray(catalog.promoBanners) ? catalog.promoBanners : [])
    .slice(0, CAP_CARD_COUNT)
    .map((item: unknown, index: number) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        id: cleanText(row.id ?? `promo-${index + 1}`, 64),
        title: cleanText(row.title),
        subtitle: cleanText(row.subtitle),
        code: cleanText(row.code, 64),
        href: cleanText(row.href, CAP_URL),
        imageUrl: cleanText(row.imageUrl, CAP_URL),
        activeFrom: cleanText(row.activeFrom, 32),
        activeTo: cleanText(row.activeTo, 32),
        priority: cleanNumber(row.priority, 50),
        ctaLabel: cleanText(row.ctaLabel ?? "Открыть", 64),
        discountType: row.discountType === "percent" || row.discountType === "fixed" ? row.discountType : "",
        discountValue: cleanNumber(row.discountValue ?? row.discount_value, 0),
        maxDiscount: cleanNumber(row.maxDiscount ?? row.max_discount, 0),
        minSubtotal: cleanNumber(row.minSubtotal ?? row.min_subtotal, 0),
      };
    });

  const adCards: CatalogAdCardRow[] = (Array.isArray(catalog.adCards) ? catalog.adCards : [])
    .slice(0, CAP_CARD_COUNT)
    .map((item: unknown, index: number) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        id: cleanText(row.id ?? `ad-${index + 1}`, 64),
        title: cleanText(row.title),
        subtitle: cleanText(row.subtitle),
        href: cleanText(row.href, CAP_URL),
        imageUrl: cleanText(row.imageUrl, CAP_URL),
        badge: cleanText(row.badge, 64),
        activeFrom: cleanText(row.activeFrom, 32),
        activeTo: cleanText(row.activeTo, 32),
        priority: cleanNumber(row.priority, 40),
        ctaLabel: cleanText(row.ctaLabel ?? "Подробнее", 64),
      };
    });

  return { ok: true, canEdit, promoBanners, adCards };
}

// ── save ─────────────────────────────────────────────────────────────────────

export type SaveCatalogCardsResult =
  | { ok: true; message: string; promoBanners: CatalogPromoBannerRow[]; adCards: CatalogAdCardRow[] }
  | { ok: false; error: string };

export async function saveFranchizeCatalogCardsAction(input: unknown): Promise<SaveCatalogCardsResult> {
  const parsed = saveCatalogCardsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Некорректные данные карточек." };
  }

  const slug = normalizeCrewSlug(parsed.data.slug);

  // Boss round-2 blocker (B-NEW-1): личность ТОЛЬКО из подписанного cookie /
  // HMAC-верифицированного initData (resolveServerActorUserId, SA-002).
  // Клиентский actorUserId в расчёт не принимается — иначе любой, зная chat id
  // owner'а, переписал бы промо-карточки чужой витрины.
  const actorUserId = await resolveServerActorUserId({
    claimedActorUserId: parsed.data.claimedActorUserId,
    initData: parsed.data.initData,
  });
  if (!actorUserId) {
    logger.warn("[catalog-cards] unauthenticated save attempt", { slug });
    return { ok: false, error: "Действие доступно только авторизованным в Telegram-боте экипажа." };
  }

  const { data: crew, error: crewError } = await supabaseAdmin
    .from("crews")
    .select("id, slug, owner_id, metadata")
    .eq("slug", slug)
    .maybeSingle();
  if (crewError || !crew) return { ok: false, error: "Экипаж не найден." };

  const allowed = await resolveFranchizePromoCardsAccess(actorUserId, crew as { id: string; owner_id?: string | null });
  if (!allowed) {
    logger.warn("[catalog-cards] unauthorized save attempt", { slug, actorUserId });
    return { ok: false, error: "Недостаточно прав: карточки правят owner/co_owner/admin экипажа." };
  }

  // Сериализация: строки без заголовка/кода — мусор, выкидываем; id присваиваем
  // стабильный (slug-префикс), чтобы перегенерация списка не ломала href-якоря.
  const nowTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const promoBanners: CatalogPromoBannerRow[] = parsed.data.promoBanners
    .filter((row) => row.title.trim().length > 0 || row.code.trim().length > 0)
    .slice(0, CAP_CARD_COUNT)
    .map((row, index) => ({
      id: row.id.trim() || `promo-${nowTag}-${index + 1}`,
      title: cleanText(row.title),
      subtitle: cleanText(row.subtitle),
      code: cleanText(row.code, 64).toUpperCase(),
      href: safeCardHref(row.href),
      imageUrl: safeCardHref(row.imageUrl),
      activeFrom: cleanText(row.activeFrom, 32),
      activeTo: cleanText(row.activeTo, 32),
      priority: cleanNumber(row.priority, 50),
      ctaLabel: cleanText(row.ctaLabel, 64) || "Открыть",
      discountType: row.discountType === "percent" || row.discountType === "fixed" ? row.discountType : "",
      // Значение скидки без типа — не валидируется сервером, приводим к типу:
      // число с "%"-семантикой опасно трактовать как ₽ — сохраняем как есть,
      // сервер читает discountType+discountValue парой.
      discountValue: cleanNumber(row.discountValue, 0),
      maxDiscount: cleanNumber(row.maxDiscount, 0),
      minSubtotal: cleanNumber(row.minSubtotal, 0),
    }));

  const adCards: CatalogAdCardRow[] = parsed.data.adCards
    .filter((row) => row.title.trim().length > 0)
    .slice(0, CAP_CARD_COUNT)
    .map((row, index) => ({
      id: row.id.trim() || `ad-${nowTag}-${index + 1}`,
      title: cleanText(row.title),
      subtitle: cleanText(row.subtitle),
      href: safeCardHref(row.href),
      imageUrl: safeCardHref(row.imageUrl),
      badge: cleanText(row.badge, 64),
      activeFrom: cleanText(row.activeFrom, 32),
      activeTo: cleanText(row.activeTo, 32),
      priority: cleanNumber(row.priority, 40),
      ctaLabel: cleanText(row.ctaLabel, 64) || "Подробнее",
    }));

  // Read-modify-write: перезаписываем ТОЛЬКО catalog.promoBanners/adCards,
  // все остальные ключи metadata остаются нетронутыми.
  const metadata = (crew.metadata && typeof crew.metadata === "object" ? crew.metadata : {}) as Record<string, unknown>;
  const franchize = (metadata.franchize && typeof metadata.franchize === "object" ? metadata.franchize : {}) as Record<string, unknown>;
  const catalog = (franchize.catalog && typeof franchize.catalog === "object" ? franchize.catalog : {}) as Record<string, unknown>;
  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    franchize: {
      ...franchize,
      catalog: {
        ...catalog,
        promoBanners,
        adCards,
      },
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from("crews")
    .update({ metadata: nextMetadata })
    .eq("slug", slug);

  if (updateError) {
    logger.error("[catalog-cards] metadata update failed", { slug, error: updateError.message });
    return { ok: false, error: "Не удалось сохранить карточки. Попробуйте ещё раз." };
  }

  // Каталог — серверный компонент: ревалидим витрину, чтобы новые карточки
  // появились сразу (плюс router.refresh() на клиенте для текущей вкладки).
  revalidatePath(`/franchize/${slug}`);
  revalidatePath(`/`);

  logger.info("[catalog-cards] saved", { slug, actorUserId, promoBanners: promoBanners.length, adCards: adCards.length });
  return {
    ok: true,
    message: `Сохранено: промо-баннеров ${promoBanners.length}, анонсов ${adCards.length}.`,
    promoBanners,
    adCards,
  };
}
