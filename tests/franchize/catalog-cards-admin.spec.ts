// tests/franchize/catalog-cards-admin.spec.ts
//
// Boss request (2026-10-11): быстрая админка промо-карточек главной витрины.
//   1. роль-гейт: owner / co_owner / admin экипажа + платформенный admin —
//      МОГУТ; обычный член, арендатор и аноним — НЕТ;
//   2. save-экшен: защита от чужих правок, чистка строк (мусор выкидывается,
//      коды uppercase, стабильные id), read-modify-write метадаты
//      с сохранением соседних ключей, revalidatePath витрины.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  supabaseAdmin: { from: mocks.from },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// SA-002 (boss round 2): личность resolving СЕРВЕРОМ. В спеках подменяем
// резолвер: «claimedActorUserId» трактуется как верифицированный initData.
vi.mock("@/app/franchize/server-actions/shared/auth-helpers", () => ({
  resolveServerActorUserId: vi.fn(async (input?: { claimedActorUserId?: string }) =>
    input?.claimedActorUserId ? String(input.claimedActorUserId) : null),
}));

import { resolveServerActorUserId } from "@/app/franchize/server-actions/shared/auth-helpers";
import { safeCardHref } from "@/app/franchize/lib/catalog-cards-shared";
import {
  loadFranchizeCatalogCardsAction,
  resolveFranchizePromoCardsAccess,
  saveFranchizeCatalogCardsAction,
} from "@/app/franchize/server-actions/catalog-cards";

/** Захват аргумента .update() на crews — единственная запись в тестах. */
let writtenMetadata: Record<string, unknown> | null = null;

interface RowShape {
  [key: string]: unknown;
}

/**
 * Таблица-роутер: users/crew_members отвечают по фиксированному сценарию,
 * crews — отдают metadata и захватывают .update(patch).
 */
function mockTables(handlers: {
  userRow?: unknown;
  memberRow?: unknown;
  crewRow?: { data: unknown; error?: unknown };
  updateError?: unknown;
}) {
  const wrap = (result: unknown) => ({ data: result, error: null });
  // Универсальная цепочка: любое число .eq()/.limit() → maybeSingle(res).
  const chain = (result: { data: unknown; error: unknown }) => {
    const c: Record<string, unknown> = {
      eq: () => c,
      limit: () => c,
      order: () => c,
      maybeSingle: async () => result,
      single: async () => result,
    };
    return c;
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === "users") {
      return { select: () => chain(wrap(handlers.userRow ?? null)) };
    }
    if (table === "crew_members") {
      return { select: () => chain(wrap(handlers.memberRow ?? null)) };
    }
    if (table === "crews") {
      const res = handlers.crewRow ?? { data: null };
      return {
        select: () => chain(wrap(res.data)),
        update: (patch: Record<string, unknown>) => {
          writtenMetadata = (patch.metadata as Record<string, unknown>) ?? null;
          // server делает await ...update().eq() и деструктурирует { error } —
          // поэтому error живёт НА САМОЙ цепочке
          const c: Record<string, unknown> = {
            eq: () => c,
            limit: () => c,
            maybeSingle: async () => ({ data: null, error: handlers.updateError ?? null }),
            error: handlers.updateError ?? null,
          };
          return c;
        },
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

const CREW = { id: "crew-1", slug: "vip-bike", owner_id: "100", metadata: {} };

beforeEach(() => {
  vi.clearAllMocks();
  writtenMetadata = null;
});

describe("safeCardHref (injection guard)", () => {
  it("allows same-origin paths and https URLs", () => {
    expect(safeCardHref("/franchize/vip-bike/wheel")).toBe("/franchize/vip-bike/wheel");
    expect(safeCardHref("https://v0-car-test.vercel.app/franchize/vip-bike")).toBe("https://v0-car-test.vercel.app/franchize/vip-bike");
  });

  it("strips javascript:, data:, protocol-relative and other hostile schemes", () => {
    expect(safeCardHref("javascript:alert(1)")).toBe("");
    expect(safeCardHref("data:text/html,<script>x</script>")).toBe("");
    expect(safeCardHref("//evil.example/phish")).toBe("");
    expect(safeCardHref("http://insecure.example")).toBe("");
    expect(safeCardHref("")).toBe("");
  });
});

describe("resolveFranchizePromoCardsAccess (owner/co_owner/admin gate)", () => {
  it("allows the crew owner row (owner_id match)", async () => {
    mockTables({});
    expect(await resolveFranchizePromoCardsAccess("100", CREW)).toBe(true);
  });

  it("allows active co_owner membership", async () => {
    mockTables({ memberRow: { role: "co_owner", membership_status: "active" } });
    expect(await resolveFranchizePromoCardsAccess("200", CREW)).toBe(true);
  });

  it("allows active admin membership", async () => {
    mockTables({ memberRow: { role: "admin", membership_status: "active" } });
    expect(await resolveFranchizePromoCardsAccess("300", CREW)).toBe(true);
  });

  it("rejects a plain active member and a stale admin membership", async () => {
    mockTables({ memberRow: { role: "member", membership_status: "active" } });
    expect(await resolveFranchizePromoCardsAccess("400", CREW)).toBe(false);

    mockTables({ memberRow: { role: "admin", membership_status: "banned" } });
    expect(await resolveFranchizePromoCardsAccess("500", CREW)).toBe(false);
  });

  it("rejects anonymous callers", async () => {
    mockTables({});
    expect(await resolveFranchizePromoCardsAccess(undefined, CREW)).toBe(false);
  });
});

describe("saveFranchizeCatalogCardsAction", () => {
  it("blocks an UNVERIFIED caller (no initData / no signed cookie) before anything else", async () => {
    mockTables({ crewRow: { data: CREW } });
    const res = await saveFranchizeCatalogCardsAction({
      slug: "vip-bike",
      // SA-002 regression: claimed id БЕЗ подписи не даёт прав — даже owner'а
      initData: undefined,
      claimedActorUserId: undefined,
      promoBanners: [],
      adCards: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("авторизованным");
    expect(writtenMetadata).toBeNull();
  });

  it("blocks a non-staff user before touching metadata", async () => {
    mockTables({ crewRow: { data: CREW }, memberRow: { role: "member", membership_status: "active" } });
    const res = await saveFranchizeCatalogCardsAction({
      slug: "vip-bike",
      initData: "signed-init-data",
      claimedActorUserId: "400",
      promoBanners: [],
      adCards: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Недостаточно прав");
    expect(writtenMetadata).toBeNull();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("drops empty rows, uppercases codes, mints stable ids and keeps sibling metadata keys", async () => {
    mockTables({
      crewRow: {
        data: {
          ...CREW,
          metadata: {
            franchize: { catalog: { groupOrder: ["Электро"], promoBanners: [] } },
            contacts: { telegram: "@vipbike" },
          },
        },
      },
      memberRow: { role: "co_owner", membership_status: "active" },
    });

    const res = await saveFranchizeCatalogCardsAction({
      slug: "vip-bike",
      initData: "signed-init-data",
      claimedActorUserId: "200",
      promoBanners: [
        {
          id: "", title: "Колесо фортуны", subtitle: "Крути и выигрывай", code: " wheel1000 ",
          href: "/franchize/vip-bike/wheel", imageUrl: "", activeFrom: "", activeTo: "",
          priority: 90, ctaLabel: "Крутить", discountType: "fixed", discountValue: 1000,
          maxDiscount: 0, minSubtotal: 0,
        },
        {
          id: "", title: "   ", subtitle: "", code: "", href: "", imageUrl: "",
          activeFrom: "", activeTo: "", priority: 0, ctaLabel: "",
          discountType: "", discountValue: 0, maxDiscount: 0, minSubtotal: 0,
        },
      ],
      adCards: [
        { id: "", title: "Новый сезон", subtitle: "", href: "", imageUrl: "", badge: "Анонс", activeFrom: "", activeTo: "", priority: 40, ctaLabel: "" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/franchize/vip-bike");

    const metadata = writtenMetadata as Record<string, any>;
    expect(metadata.franchize.catalog.groupOrder).toEqual(["Электро"]);
    expect(metadata.franchize.catalog.promoBanners).toHaveLength(1);
    expect(metadata.franchize.catalog.promoBanners[0].code).toBe("WHEEL1000");
    expect(metadata.franchize.catalog.promoBanners[0].id).toMatch(/^promo-\d{8}-1$/);
    expect(metadata.franchize.catalog.promoBanners[0].discountType).toBe("fixed");
    expect(metadata.franchize.catalog.adCards).toHaveLength(1);
    expect(metadata.franchize.catalog.adCards[0].ctaLabel).toBe("Подробнее");
    expect(metadata.contacts).toEqual({ telegram: "@vipbike" });
  });

  it("reports a friendly error when the metadata update fails", async () => {
    mockTables({
      crewRow: { data: CREW },
      memberRow: { role: "admin", membership_status: "active" },
      updateError: { message: "duplicate key" },
    });
    const res = await saveFranchizeCatalogCardsAction({
      slug: "vip-bike",
      initData: "signed-init-data",
      claimedActorUserId: "300",
      promoBanners: [],
      adCards: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("Не удалось сохранить");
  });
});

describe("loadFranchizeCatalogCardsAction", () => {
  it("returns raw rows with canEdit=true for staff", async () => {
    mockTables({
      crewRow: {
        data: {
          ...CREW,
          metadata: {
            franchize: {
              catalog: {
                promoBanners: [{ id: "p1", title: "T", code: "X", discountType: "percent", discountValue: 15 }],
                adCards: [{ id: "a1", title: "A", badge: "Анонс" }],
              },
            },
          },
        },
      },
      memberRow: { role: "owner", membership_status: "active" },
    });

    const staff = await loadFranchizeCatalogCardsAction({ slug: "vip-bike", initData: "signed", claimedActorUserId: "200" });
    expect(staff.ok).toBe(true);
    if (staff.ok) {
      expect(staff.canEdit).toBe(true);
      expect(staff.promoBanners[0]).toMatchObject({ id: "p1", discountType: "percent", discountValue: 15 });
      expect(staff.adCards[0].badge).toBe("Анонс");
    }
  });

  it("flags read-only for non-staff instead of hiding data", async () => {
    mockTables({
      crewRow: { data: { ...CREW, metadata: { franchize: { catalog: { adCards: [] } } } } },
      memberRow: { role: "member", membership_status: "active" },
    });
    const res = await loadFranchizeCatalogCardsAction({ slug: "vip-bike", initData: "signed", claimedActorUserId: "400" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.canEdit).toBe(false);
  });

  it("denies an anonymous load outright (no identity → no config leak)", async () => {
    mockTables({ crewRow: { data: { ...CREW, metadata: { franchize: { catalog: {} } } } } });
    const res = await loadFranchizeCatalogCardsAction({ slug: "vip-bike" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("авторизованным");
  });
});

// тип-заглушка, чтобы TS не ругался на RowShape (используется в mockTables)
export type { RowShape };
