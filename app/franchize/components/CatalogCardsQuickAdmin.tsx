"use client";

// app/franchize/components/CatalogCardsQuickAdmin.tsx
// ─────────────────────────────────────────────────────────────────────────────
// БЫСТРАЯ админка промо-карточек каталога (boss request 2026-10-11).
//
// Плавающая кнопка «Карточки» на главной витрине → выдвижная панель с двумя
// списками: промо-баннеры (code + скидка %/₽ + окно действия) и анонсы
// (adCards). Гидратация витрины — из crews.metadata.franchize.catalog.*,
// сохранение — saveFranchizeCatalogCardsAction (owner/co_owner/admin).
//
// Видимость: клиентская проверка — UX-удобство; сервер перепроверяет роли
// на каждом load/save (resolveFranchizePromoCardsAccess).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, PencilLine, Plus, Trash2, X } from "lucide-react";

import { useAppContext } from "@/contexts/AppContext";
import { useIsAdmin } from "@/app/franchize/hooks/useIsAdmin";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import {
  loadFranchizeCatalogCardsAction,
  saveFranchizeCatalogCardsAction,
  type CatalogAdCardRow,
  type CatalogPromoBannerRow,
} from "@/app/franchize/server-actions/catalog-cards";

interface CatalogCardsQuickAdminProps {
  slug: string;
}

const EMPTY_BANNER: CatalogPromoBannerRow = {
  id: "", title: "", subtitle: "", code: "", href: "", imageUrl: "",
  activeFrom: "", activeTo: "", priority: 50, ctaLabel: "Открыть",
  discountType: "", discountValue: 0, maxDiscount: 0, minSubtotal: 0,
};

const EMPTY_AD: CatalogAdCardRow = {
  id: "", title: "", subtitle: "", href: "", imageUrl: "",
  badge: "", activeFrom: "", activeTo: "", priority: 40, ctaLabel: "Подробнее",
};

export function CatalogCardsQuickAdmin({ slug }: CatalogCardsQuickAdminProps) {
  const router = useRouter();
  const { dbUser, userCrewMemberships, userCrewMembershipsLoaded } = useAppContext();
  const userIsPlatformAdmin = useIsAdmin();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"banners" | "ads">("banners");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banners, setBanners] = useState<CatalogPromoBannerRow[]>([]);
  const [ads, setAds] = useState<CatalogAdCardRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Видимость вкладки: owner/co_owner/admin экипажа или платформенный админ.
  const isCrewManager = useMemo(
    () => userCrewMemberships.some(
      (m) => m.slug === slug && ["owner", "admin", "co_owner"].includes(m.role),
    ),
    [userCrewMemberships, slug],
  );
  const visible = Boolean(dbUser?.user_id) && (isCrewManager || userIsPlatformAdmin);

  const load = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoading(true);
    try {
      // SA-002: личность подтверждается СЕРВЕРОМ (cookie / HMAC initData);
      // claimedActorUserId нужен только как cross-check initData.
      const res = await loadFranchizeCatalogCardsAction({
        slug,
        initData: getTelegramInitData(),
        claimedActorUserId: String(dbUser.user_id),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.canEdit) {
        toast.info("Карточки доступны в режиме чтения — правки сохраняет только owner/co_owner/admin.");
      }
      setBanners(res.promoBanners);
      setAds(res.adCards);
    } catch {
      toast.error("Не удалось загрузить карточки.");
    } finally {
      setLoading(false);
    }
  }, [dbUser?.user_id, slug]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!dbUser?.user_id || saving) return;
    setSaving(true);
    try {
      // SA-002: сервер решает роль по подписанной личности, id из стейта —
      // только cross-check initData.
      const res = await saveFranchizeCatalogCardsAction({
        slug,
        initData: getTelegramInitData(),
        claimedActorUserId: String(dbUser.user_id),
        promoBanners: banners,
        adCards: ads,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBanners(res.promoBanners);
      setAds(res.adCards);
      toast.success(res.message);
      router.refresh(); // перегидратировать серверный каталог с новыми карточками
      setOpen(false);
    } catch {
      toast.error("Не удалось сохранить карточки.");
    } finally {
      setSaving(false);
    }
  }, [ads, banners, dbUser?.user_id, router, saving, slug]);

  if (!visible || !userCrewMembershipsLoaded) return null;

  const shownBanners = tab === "banners";
  const list = shownBanners ? banners : ads;

  const updateBanner = (index: number, patch: Partial<CatalogPromoBannerRow>) =>
    setBanners((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateAd = (index: number, patch: Partial<CatalogAdCardRow>) =>
    setAds((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index: number) => {
    if (shownBanners) setBanners((prev) => prev.filter((_, i) => i !== index));
    else setAds((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    if (shownBanners) {
      setBanners((prev) => [...prev, { ...EMPTY_BANNER }]);
      setExpandedId(`new-banner-${banners.length}`);
    } else {
      setAds((prev) => [...prev, { ...EMPTY_AD }]);
      setExpandedId(`new-ad-${ads.length}`);
    }
  };

  const rowKey = (row: { id: string }, index: number) => row.id || `${shownBanners ? "banner" : "ad"}-${index}`;

  return (
    <>
      {/* Плавающая кнопка быстрой админки (только staff).
          boss 2026-10-20: на витрине каталога блок «стрелка вверх + корзина»
          занимает bottom-[calc(6rem+safe)] … ~144px — кнопка «Карточки»
          перекрывалась им (тот же right-4, z ниже). Ставим её СТРОГО ВЫШЕ
          этого блока (верх корзины ≈144px → 10rem = 160px + safe-area). */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Редактировать промо-карточки"
        className="fixed bottom-[calc(10rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-lg transition hover:opacity-90 active:scale-95 lg:bottom-6"
        style={{ backgroundColor: "var(--franchize-accent-main, #D99A00)", color: "var(--franchize-accent-contrast, #1a1a1a)" }}
      >
        <PencilLine className="h-4 w-4" />
        Карточки
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={() => (saving ? null : setOpen(false))}>
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:rounded-3xl"
            style={{ backgroundColor: "var(--franchize-bg-card, #141414)", borderColor: "var(--franchize-border-soft, #2a2a2a)", color: "var(--franchize-text-primary, #fff)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)" }}>
              <div>
                <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--franchize-accent-main, #D99A00)" }}>
                  Быстрая админка · {slug}
                </p>
                <h2 className="mt-0.5 text-lg font-bold">Карточки каталога</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                disabled={saving}
                className="rounded-full p-2 transition hover:opacity-80 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-5 pt-4">
              {([
                ["banners", `Промо-баннеры (${banners.length})`],
                ["ads", `Анонсы (${ads.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className="rounded-xl px-3 py-2 text-sm font-semibold transition"
                  style={
                    tab === key
                      ? { backgroundColor: "var(--franchize-accent-main, #D99A00)", color: "var(--franchize-accent-contrast, #1a1a1a)" }
                      : { backgroundColor: "transparent", color: "var(--franchize-text-secondary, #999)", border: "1px solid var(--franchize-border-soft, #2a2a2a)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" /> Загружаем карточки...
                </div>
              ) : list.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                  {shownBanners
                    ? "Промо-баннеров нет — каталог покажет бегущую строку. Добавьте первую карточку."
                    : "Анонсов нет. Добавьте первый рекламный блок."}
                </p>
              ) : (
                list.map((row, index) => {
                  const key = rowKey(row, index);
                  const expanded = expandedId === key;
                  return (
                    <div key={key} className="rounded-2xl border" style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : key)}
                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">
                            {row.title || (shownBanners ? "Промо без заголовка" : "Анонс без заголовка")}
                          </span>
                          <span className="block truncate text-xs" style={{ color: "var(--franchize-text-secondary, #999)" }}>
                            {shownBanners
                              ? [row.code, row.discountType === "percent" ? `${row.discountValue}%` : row.discountType === "fixed" ? `${row.discountValue} ₽` : ""].filter(Boolean).join(" · ") || "без кода"
                              : row.badge || "без бейджа"}
                          </span>
                        </span>
                        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      </button>
                      {expanded && (
                        <div className="space-y-2 border-t px-4 py-3" style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)" }}>
                          <Field label="Заголовок" value={row.title} onChange={(v) => (shownBanners ? updateBanner(index, { title: v }) : updateAd(index, { title: v }))} />
                          <Field label="Подзаголовок" value={row.subtitle} onChange={(v) => (shownBanners ? updateBanner(index, { subtitle: v }) : updateAd(index, { subtitle: v }))} />
                          {shownBanners ? (
                            <>
                              <div className="grid grid-cols-2 gap-2">
                                <Field label="Промокод" value={row.code} onChange={(v) => updateBanner(index, { code: v.toUpperCase() })} placeholder="WHEEL1000" />
                                <div>
                                  <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--franchize-text-secondary, #999)" }}>Тип скидки</label>
                                  <select
                                    value={row.discountType}
                                    onChange={(event) => updateBanner(index, { discountType: event.target.value as "" | "percent" | "fixed" })}
                                    className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
                                    style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)", color: "var(--franchize-text-primary, #fff)" }}
                                  >
                                    <option value="">без скидки</option>
                                    <option value="percent">процент %</option>
                                    <option value="fixed">фикс. ₽</option>
                                  </select>
                                </div>
                              </div>
                              {row.discountType && (
                                <div className="grid grid-cols-3 gap-2">
                                  <Field label={row.discountType === "percent" ? "Процент" : "Сумма ₽"} value={String(row.discountValue || "")} onChange={(v) => updateBanner(index, { discountValue: Number(v.replace(/[^\d]/g, "")) || 0 })} />
                                  <Field label="Кап скидки ₽" value={String(row.maxDiscount || "")} onChange={(v) => updateBanner(index, { maxDiscount: Number(v.replace(/[^\d]/g, "")) || 0 })} />
                                  <Field label="Мин. заказ ₽" value={String(row.minSubtotal || "")} onChange={(v) => updateBanner(index, { minSubtotal: Number(v.replace(/[^\d]/g, "")) || 0 })} />
                                </div>
                              )}
                            </>
                          ) : (
                            <Field label="Бейдж" value={row.badge} onChange={(v) => updateAd(index, { badge: v })} placeholder="Анонс" />
                          )}
                          <Field label="Ссылка (href)" value={row.href} onChange={(v) => (shownBanners ? updateBanner(index, { href: v }) : updateAd(index, { href: v }))} placeholder="/franchize/vip-bike/wheel" />
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Активна с (YYYY-MM-DD)" value={row.activeFrom} onChange={(v) => (shownBanners ? updateBanner(index, { activeFrom: v }) : updateAd(index, { activeFrom: v }))} placeholder="2026-10-11" />
                            <Field label="Активна до (YYYY-MM-DD)" value={row.activeTo} onChange={(v) => (shownBanners ? updateBanner(index, { activeTo: v }) : updateAd(index, { activeTo: v }))} placeholder="2026-11-01" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="Приоритет" value={String(row.priority)} onChange={(v) => (shownBanners ? updateBanner(index, { priority: Number(v.replace(/[^\d]/g, "")) || 0 }) : updateAd(index, { priority: Number(v.replace(/[^\d]/g, "")) || 0 }))} />
                            <Field label="Кнопка" value={row.ctaLabel} onChange={(v) => (shownBanners ? updateBanner(index, { ctaLabel: v }) : updateAd(index, { ctaLabel: v }))} />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80"
                            style={{ borderColor: "#ef444455", color: "#ef4444" }}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Удалить карточку
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t px-5 py-4" style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)" }}>
              <button
                type="button"
                onClick={addRow}
                disabled={saving || list.length >= 12}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)" }}
              >
                <Plus className="h-4 w-4" /> Добавить
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--franchize-accent-main, #D99A00)", color: "var(--franchize-accent-contrast, #1a1a1a)" }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--franchize-text-secondary, #999)" }}>{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: "var(--franchize-border-soft, #2a2a2a)", color: "var(--franchize-text-primary, #fff)" }}
      />
    </div>
  );
}
