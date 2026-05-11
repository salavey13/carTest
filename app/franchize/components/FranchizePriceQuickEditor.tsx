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
  crewPaletteForSurface,
  focusRingOutlineStyle,
  readablePaletteTextOnColor,
  withAlpha,
} from "@/app/franchize/lib/theme";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import type { Database } from "@/types/database.types";
import { FranchizeOperatorLinkButton, FranchizeOperatorPanel } from "./FranchizeOperatorSurface";

type Vehicle = Database["public"]["Tables"]["cars"]["Row"];

type PriceDraft = {
  dailyPrice: string;
  salePrice: string;
  hidden: boolean;
};

interface FranchizePriceQuickEditorProps {
  initialSlug: string;
  initialCrew: FranchizeCrewVM;
}

export function FranchizePriceQuickEditor({ initialSlug, initialCrew }: FranchizePriceQuickEditorProps) {
  const { dbUser, isLoading } = useAppContext();
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PriceDraft>>({});
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const slug = initialSlug?.trim() || "vip-bike";
  const crew = initialCrew;

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingFleet(true);
    const res = await getEditableVehiclesForUser(dbUser.user_id);
    setLoadingFleet(false);

    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter(
      (item) =>
        (item.type === "bike" || item.type === "car") &&
        (!crew.id || item.crew_id === crew.id || item.owner_id === dbUser.user_id),
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
              salePrice: String(Number(specs.sale_price || 0) || ""),
              hidden:
                specs.hidden === true ||
                specs.hidden === 1 ||
                String(specs.hidden).toLowerCase() === "true" ||
                String(specs.hidden) === "1",
            },
          ];
        }),
      ),
    );
  }, [crew.id, dbUser?.user_id]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const saleEnabledCount = useMemo(() => {
    return fleet.filter((vehicle) => {
      const sale = (vehicle.specs as Record<string, unknown> | null)?.sale;
      return sale === true || sale === 1 || String(sale).toLowerCase() === "true" || String(sale) === "1";
    }).length;
  }, [fleet]);

  const handleSave = useCallback(
    async (vehicle: Vehicle) => {
      const draft = drafts[vehicle.id];
      if (!draft) return;

      const nextDaily = Number(draft.dailyPrice || 0);
      const nextSale = Number(draft.salePrice || 0);

      if (Number.isNaN(nextDaily) || Number.isNaN(nextSale)) {
        toast.error("Цена должна быть числом");
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
            daily_price: nextDaily,
            specs: {
              ...currentSpecs,
              sale_price: nextSale,
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

  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);

  if (isLoading) return <Loading text="Загружаем быстрый прайс-редактор..." />;

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-admin-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-admin-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-admin-muted" as string]: crew.theme.palette.textSecondary,
        ["--fr-admin-border" as string]: crew.theme.palette.borderSoft,
      }}
    >
      <p className="text-xs font-medium tracking-wide text-[var(--fr-admin-accent)]">Операторская подстраница</p>
      <h1 className="text-2xl font-semibold text-[var(--fr-admin-text)]">Быстрая правка цен</h1>
      <p className="text-sm text-[var(--fr-admin-muted)]">
        Минимальный список мотов/авто: аренда в день + цена продажи (если sale включен в specs).
      </p>

      <FranchizeOperatorPanel>
        <p className="text-xs text-[var(--fr-admin-muted)]">
          Всего карточек: <span className="font-semibold text-[var(--fr-admin-accent)]">{fleet.length}</span> · Sale включен: <span className="font-semibold text-[var(--fr-admin-accent)]">{saleEnabledCount}</span>
          {loadingFleet ? " · обновляем..." : ""}
        </p>
      </FranchizeOperatorPanel>

      <div className="space-y-2">
        {fleet.map((vehicle) => {
          const specs = (vehicle.specs || {}) as Record<string, unknown>;
          const saleFlag = specs.sale === true || specs.sale === 1 || String(specs.sale).toLowerCase() === "true" || String(specs.sale) === "1";
          const draft = drafts[vehicle.id] || { dailyPrice: "0", salePrice: "", hidden: false };
          return (
            <div
              key={vehicle.id}
              className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr),140px,140px,auto] sm:items-end"
              style={{ borderColor: "var(--fr-admin-border)", backgroundColor: withAlpha(crew.theme.palette.accentMain, 0.04) }}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--fr-admin-text)]">{vehicle.make} {vehicle.model}</p>
                <p className="text-xs text-[var(--fr-admin-muted)]">{vehicle.type === "bike" ? "🏍️" : "🚗"} {vehicle.id}</p>
              </div>

              <label className="text-xs text-[var(--fr-admin-muted)]">
                Аренда / день
                <Input
                  type="number"
                  value={draft.dailyPrice}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [vehicle.id]: { ...draft, dailyPrice: e.target.value } }))}
                />
              </label>

              <label className="text-xs text-[var(--fr-admin-muted)]">
                Sale цена
                <Input
                  type="number"
                  value={draft.salePrice}
                  disabled={!saleFlag}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [vehicle.id]: { ...draft, salePrice: e.target.value } }))}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--fr-admin-muted)] sm:col-start-2">
                <input
                  type="checkbox"
                  checked={draft.hidden}
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [vehicle.id]: { ...draft, hidden: e.target.checked },
                    }))
                  }
                />
                Скрыть на витрине
              </label>

              <Button
                type="button"
                className="h-10"
                onClick={() => void handleSave(vehicle)}
                disabled={savingId === vehicle.id}
                style={{ ...buttonFocus, backgroundColor: crew.theme.palette.accentMain, color: accentOn }}
              >
                {savingId === vehicle.id ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <FranchizeOperatorLinkButton href={`/franchize/${slug}/admin`} variant="secondary">
          ← Назад в админку
        </FranchizeOperatorLinkButton>
        <Button asChild variant="outline" className="h-9" style={{ borderColor: "var(--fr-admin-border)", backgroundColor: surface.page.backgroundColor }}>
          <Link href={`/franchize/${slug}`}>Открыть витрину</Link>
        </Button>
      </div>
    </div>
  );
}
