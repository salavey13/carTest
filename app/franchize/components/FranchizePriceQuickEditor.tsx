"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { type FranchizeCrewVM } from "@/app/franchize/actions";
import {
  focusRingOutlineStyle,
  readablePaletteTextOnColor,
  withAlpha,
} from "@/app/franchize/lib/theme";
import { useResolvedPalette } from "@/app/franchize/lib/useResolvedPalette";
import { fallbackCrew } from "@/app/franchize/lib/fallback-crew";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import type { Database } from "@/types/database.types";
import { FranchizeOperatorLinkButton, FranchizeOperatorPanel } from "./FranchizeOperatorSurface";

type Vehicle = Database["public"]["Tables"]["cars"]["Row"];

type PriceDraft = {
  // Existing
  dailyPrice: string;
  salePrice: string;
  hidden: boolean;

  // Hourly rates
  pricePerHour: string;
  pricePer3h: string;
  pricePer6h: string;
  pricePer12h: string;

  // Day-type pricing
  rentWeekday: string;
  rentWeekend: string;

  // Multi-day pricing
  rent2_4d: string;
  rent5_10d: string;
  rent11_30d: string;

  // Totalled (loss compensation)
  priceRub: string;
};

interface FranchizePriceQuickEditorProps {
  initialSlug: string;
  initialCrew: FranchizeCrewVM;
}

// Helper to safely convert value to number string
const safeNum = (val: unknown): string => String(Number(val || 0) || "");

// Helper to check if specs sale flag is true
const isSaleEnabled = (specs: Record<string, unknown> | null): boolean => {
  if (!specs) return false;
  const sale = specs.sale;
  return sale === true || sale === 1 || String(sale).toLowerCase() === "true" || String(sale) === "1";
};

// Helper to check if hidden flag is true
const isHidden = (specs: Record<string, unknown> | null): boolean => {
  if (!specs) return false;
  const hidden = specs.hidden;
  return hidden === true || hidden === 1 || String(hidden).toLowerCase() === "true" || String(hidden) === "1";
};

export function FranchizePriceQuickEditor({ initialSlug, initialCrew }: FranchizePriceQuickEditorProps) {
  const { dbUser, isLoading } = useAppContext();
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Track which vehicle cards are expanded
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const slug = initialSlug?.trim() || "vip-bike";
  const crew = initialCrew;
  const palette = useResolvedPalette(crew?.theme ?? fallbackCrew.theme);

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingFleet(true);
    const res = await getEditableVehiclesForUser(dbUser?.user_id);
    setLoadingFleet(false);

    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter(
      (item) =>
        (item.type === "bike" || item.type === "car") &&
        (!crew.id || item.crew_id === crew.id || item.owner_id === dbUser?.user_id),
    );

    setFleet(scoped);
    setDrafts(
      Object.fromEntries(
        scoped.map((vehicle) => {
          const specs = (vehicle.specs || {}) as Record<string, unknown>;
          return [
            vehicle.id,
            {
              dailyPrice: String(vehicle.daily_price ?? 0),
              salePrice: safeNum(specs.sale_price),
              hidden: isHidden(specs),

              // Hourly
              pricePerHour: safeNum(specs.price_per_hour),
              pricePer3h: safeNum(specs.price_per_3h),
              pricePer6h: safeNum(specs.price_per_6h),
              pricePer12h: safeNum(specs.price_per_12h),

              // Daily
              rentWeekday: safeNum(specs.rent_weekday),
              rentWeekend: safeNum(specs.rent_weekend),

              // Multi-day
              rent2_4d: safeNum(specs["rent_2_4d"]),
              rent5_10d: safeNum(specs["rent_5-10d"]),
              rent11_30d: safeNum(specs["rent_11_30d"]),

              // Totalled
              priceRub: safeNum(specs.price_rub),
            },
          ];
        }),
      ),
    );
  }, [crew.id, dbUser?.user_id]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  // Toggle expand/collapse for a vehicle card
  const toggleExpanded = useCallback((vehicleId: string) => {
    setExpandedCards((prev) => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
  }, []);

  // Expand all cards
  const expandAll = useCallback(() => {
    setExpandedCards(Object.fromEntries(fleet.map((v) => [v.id, true])));
  }, [fleet]);

  // Collapse all cards
  const collapseAll = useCallback(() => {
    setExpandedCards({});
  }, []);

  const saleEnabledCount = useMemo(() => {
    return fleet.filter((vehicle) => isSaleEnabled(vehicle.specs as Record<string, unknown> | null)).length;
  }, [fleet]);

  // Count vehicles with various pricing set
  const pricingStats = useMemo(() => {
    let withHourly = 0;
    let withMultiDay = 0;
    let withTotalled = 0;

    fleet.forEach((vehicle) => {
      const specs = vehicle.specs as Record<string, unknown> | null;
      if (specs) {
        if (specs.price_per_hour || specs.price_per_3h || specs.price_per_6h || specs.price_per_12h) {
          withHourly++;
        }
        if (specs["rent_2_4d"] || specs["rent_5-10d"] || specs["rent_11_30d"]) {
          withMultiDay++;
        }
        if (specs.price_rub) {
          withTotalled++;
        }
      }
    });

    return { withHourly, withMultiDay, withTotalled };
  }, [fleet]);

  const handleSave = useCallback(
    async (vehicle: Vehicle) => {
      const draft = drafts[vehicle.id];
      if (!draft) return;

      // Validate all numeric fields
      const numFields = [
        draft.dailyPrice,
        draft.salePrice,
        draft.pricePerHour,
        draft.pricePer3h,
        draft.pricePer6h,
        draft.pricePer12h,
        draft.rentWeekday,
        draft.rentWeekend,
        draft.rent2_4d,
        draft.rent5_10d,
        draft.rent11_30d,
        draft.priceRub,
      ];

      if (numFields.some((v) => Number.isNaN(Number(v)))) {
        toast.error("Все цены должны быть числами");
        return;
      }

      setSavingId(vehicle.id);
      try {
        const currentSpecs = ((vehicle.specs || {}) as Record<string, unknown>) || {};
        const response = await fetch("/api/cars", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...vehicle,
            title: `${vehicle.make ?? ""} ${vehicle.model ?? ""}`.trim() || String(vehicle.model || "Без названия"),
            daily_price: Number(draft.dailyPrice) || 0,
            specs: {
              ...currentSpecs,
              // Hourly
              price_per_hour: Number(draft.pricePerHour) || 0,
              price_per_3h: Number(draft.pricePer3h) || 0,
              price_per_6h: Number(draft.pricePer6h) || 0,
              price_per_12h: Number(draft.pricePer12h) || 0,
              // Daily
              rent_weekday: Number(draft.rentWeekday) || 0,
              rent_weekend: Number(draft.rentWeekend) || 0,
              dailyPrice: Number(draft.dailyPrice) || 0, // Keep in sync
              // Multi-day
              "rent_2_4d": Number(draft.rent2_4d) || 0,
              "rent_5-10d": Number(draft.rent5_10d) || 0,
              "rent_11_30d": Number(draft.rent11_30d) || 0,
              // Sale & Totalled
              sale_price: Number(draft.salePrice) || 0,
              price_rub: Number(draft.priceRub) || 0,
              // Existing
              hidden: draft.hidden,
            },
          }),
        });

        if (!response.ok) {
          toast.error("Не удалось сохранить цену");
          return;
        }

        toast.success("Цены сохранены");
        await loadFleet();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Ошибка сохранения: ${error.message}`
            : "Ошибка сохранения цены",
        );
      } finally {
        setSavingId(null);
      }
    },
    [drafts, loadFleet],
  );

  const updateDraft = useCallback((vehicleId: string, field: keyof PriceDraft, value: string | boolean) => {
    setDrafts((prev) => {
      const current = prev[vehicleId];
      if (!current) return prev;
      return { ...prev, [vehicleId]: { ...current, [field]: value } };
    });
  }, []);

  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = readablePaletteTextOnColor(palette.accentMain, palette);

  if (isLoading) return <Loading text="Загружаем быстрый прайс-редактор..." />;

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-admin-accent" as string]: palette.accentMain,
        ["--fr-admin-text" as string]: palette.textPrimary,
        ["--fr-admin-muted" as string]: palette.textSecondary,
        ["--fr-admin-border" as string]: palette.borderSoft,
      }}
    >
      <p className="text-xs font-medium tracking-wide text-[var(--fr-admin-accent)]">Операторская подстраница</p>
      <h1 className="text-2xl font-semibold text-[var(--fr-admin-text)]">Быстрая правка цен</h1>
      <p className="text-sm text-[var(--fr-admin-muted)]">
        Полный список цен: почасовые, дневные,-multi-day скидки, sale и totalled (компенсация при уничтожении).
      </p>

      <FranchizeOperatorPanel>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fr-admin-muted)]">
          <span>
            Всего: <span className="font-semibold text-[var(--fr-admin-accent)]">{fleet.length}</span>
          </span>
          <span>
            Sale: <span className="font-semibold text-[var(--fr-admin-accent)]">{saleEnabledCount}</span>
          </span>
          <span>
            Hourly rates: <span className="font-semibold text-[var(--fr-admin-accent)]">{pricingStats.withHourly}</span>
          </span>
          <span>
            Multi-day: <span className="font-semibold text-[var(--fr-admin-accent)]">{pricingStats.withMultiDay}</span>
          </span>
          <span>
            Totalled: <span className="font-semibold text-[var(--fr-admin-accent)]">{pricingStats.withTotalled}</span>
          </span>
          {loadingFleet && <span>· обновляем...</span>}
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={expandAll}
          >
            Развернуть все
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={collapseAll}
          >
            Свернуть все
          </Button>
        </div>
      </FranchizeOperatorPanel>

      <div className="space-y-3">
        {fleet.map((vehicle) => {
          const specs = (vehicle.specs || {}) as Record<string, unknown>;
          const saleFlag = isSaleEnabled(specs);
          const draft = drafts[vehicle.id];
          const isExpanded = expandedCards[vehicle.id];

          if (!draft) return null;

          // Count set prices for this vehicle
          const priceCount = [
            draft.pricePerHour,
            draft.pricePer3h,
            draft.pricePer6h,
            draft.pricePer12h,
            draft.rentWeekday,
            draft.rentWeekend,
            draft.rent2_4d,
            draft.rent5_10d,
            draft.rent11_30d,
            draft.salePrice,
            draft.priceRub,
          ].filter((v) => v && v !== "0").length;

          return (
            <div
              key={vehicle.id}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: "var(--fr-admin-border)",
                backgroundColor: withAlpha(palette.accentMain, 0.04),
              }}
            >
              {/* Header - always visible */}
              <div className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
                      {vehicle.type === "bike" ? "🏍️" : "🚗"} {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-xs text-[var(--fr-admin-muted)]">{vehicle.id}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-[var(--fr-admin-muted)]">
                      <input
                        type="checkbox"
                        checked={draft.hidden}
                        onChange={(e) => updateDraft(vehicle.id, "hidden", e.target.checked)}
                        className="rounded"
                      />
                      Скрыть
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => void handleSave(vehicle)}
                      disabled={savingId === vehicle.id}
                      style={{ ...buttonFocus, backgroundColor: palette.accentMain, color: accentOn }}
                    >
                      {savingId === vehicle.id ? "..." : "Сохранить"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(vehicle.id)}
                      className="p-1 text-[var(--fr-admin-muted)] hover:text-[var(--fr-admin-text)] transition-transform"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 6l4 4 4-4H4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible content */}
              {isExpanded && (
                <div className="border-t px-3 sm:px-4 py-4 space-y-4" style={{ borderColor: "var(--fr-admin-border)" }}>
                  {/* Rental Pricing Section */}
                  <div>
                    <p className="text-xs font-medium text-[var(--fr-admin-accent)] mb-3">
                      📈 Арендные тарифы
                    </p>
                    <div className="space-y-4">
                      {/* Hourly Rates */}
                      <div>
                        <p className="text-xs text-[var(--fr-admin-muted)] mb-2">Почасовые тарифы</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            1 час
                            <Input
                              type="number"
                              placeholder="₽"
                              value={draft.pricePerHour}
                              onChange={(e) => updateDraft(vehicle.id, "pricePerHour", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            3 часа
                            <Input
                              type="number"
                              placeholder="₽"
                              value={draft.pricePer3h}
                              onChange={(e) => updateDraft(vehicle.id, "pricePer3h", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            6 часов
                            <Input
                              type="number"
                              placeholder="₽"
                              value={draft.pricePer6h}
                              onChange={(e) => updateDraft(vehicle.id, "pricePer6h", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            12 часов
                            <Input
                              type="number"
                              placeholder="₽"
                              value={draft.pricePer12h}
                              onChange={(e) => updateDraft(vehicle.id, "pricePer12h", e.target.value)}
                              className="h-8"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Daily Rates */}
                      <div>
                        <p className="text-xs text-[var(--fr-admin-muted)] mb-2">Дневные тарифы</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            Базовый / день
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.dailyPrice}
                              onChange={(e) => updateDraft(vehicle.id, "dailyPrice", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            Будни / день
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.rentWeekday}
                              onChange={(e) => updateDraft(vehicle.id, "rentWeekday", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            Выходные / день
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.rentWeekend}
                              onChange={(e) => updateDraft(vehicle.id, "rentWeekend", e.target.value)}
                              className="h-8"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Multi-day Rates */}
                      <div>
                        <p className="text-xs text-[var(--fr-admin-muted)] mb-2">Мульти-дневные скидки (цена за день)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            2-4 дня
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.rent2_4d}
                              onChange={(e) => updateDraft(vehicle.id, "rent2_4d", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            5-10 дней
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.rent5_10d}
                              onChange={(e) => updateDraft(vehicle.id, "rent5_10d", e.target.value)}
                              className="h-8"
                            />
                          </label>
                          <label className="text-xs text-[var(--fr-admin-muted)]">
                            11-30 дней
                            <Input
                              type="number"
                              placeholder="₽/день"
                              value={draft.rent11_30d}
                              onChange={(e) => updateDraft(vehicle.id, "rent11_30d", e.target.value)}
                              className="h-8"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sale & Totalled Section */}
                  <div>
                    <p className="text-xs font-medium text-[var(--fr-admin-accent)] mb-3">
                      💰 Sale и Totalled
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-xs text-[var(--fr-admin-muted)]">
                        Sale цена {saleFlag ? "" : "(отключено)"}
                        <Input
                          type="number"
                          placeholder="₽"
                          value={draft.salePrice}
                          disabled={!saleFlag}
                          onChange={(e) => updateDraft(vehicle.id, "salePrice", e.target.value)}
                          className="h-8"
                          style={{ opacity: saleFlag ? 1 : 0.5 }}
                        />
                      </label>
                      <label className="text-xs text-[var(--fr-admin-muted)]">
                        Totalled (компенсация при уничтожении)
                        <Input
                          type="number"
                          placeholder="₽"
                          value={draft.priceRub}
                          onChange={(e) => updateDraft(vehicle.id, "priceRub", e.target.value)}
                          className="h-8"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin`} variant="secondary">
          ← Назад в админку
        </FranchizeOperatorLinkButton>
        <Button asChild variant="outline" className="h-9" style={{ borderColor: "var(--fr-admin-border)", backgroundColor: palette.bgBase }}>
          <Link href={`/franchize/${slug}`}>Открыть витрину</Link>
        </Button>
      </div>
    </div>
  );
}
