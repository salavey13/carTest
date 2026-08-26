// app/franchize/[slug]/salary-coefficients/SalaryCoefficientsClient.tsx
"use client";

// Коэффициенты ЗП — настройка официальной схемы бонусов.
// PRD: docs/PRD_SALARY_COEFFICIENTS.md
//
// Sections:
//   1. Живой калькулятор (превью: техника + экип + цена → breakdown ЗП)
//   2. Аренда — бонусы по категориям техники + экип за единицу
//   3. Продажа — бонусы по категориям + продажа экипировки
//   4. Оверпрайс — % от наценки
//   5. Категории техники — маппинг мотоциклов (аренда / продажа)
//
// Edit: owner / co_owner / admin. View: любой участник экипажа (transparent ЗП).

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Bike,
  Tag,
  Shirt,
  Percent,
  Save,
  RotateCcw,
  Search,
  Lock,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import {
  FranchizeOperatorPanel,
  franchizeOperatorInputClassName,
  franchizeOperatorInputStyle,
} from "../../components/FranchizeOperatorSurface";
import { useFranchizeTheme } from "../../hooks/useFranchizeTheme";
import { useCrewTokens } from "../../lib/use-crew-tokens";
import { fallbackCrew } from "../../lib/fallback-crew";
import type { FranchizeCrewVM } from "@/app/franchize/actions";
import {
  getSalaryCoefficientsConfig,
  saveSalaryCoefficientsConfig,
  resetSalaryCoefficientsToOfficial,
} from "../../server-actions/salary-coefficients";
import type { SalaryBikeRow } from "../../server-actions/salary-coefficients";
import type { SalaryConfig } from "@/lib/salary-coefficients-shared";
import {
  OFFICIAL_SALARY_CONFIG,
  RENTAL_CATEGORY_LABELS,
  RENTAL_CATEGORY_DESCRIPTIONS,
  SALE_CATEGORY_LABELS,
  EQUIPMENT_SALE_LABELS,
  getDefaultBikeCategories,
  computeRentalSalary,
  computeSaleSalary,
  type RentalCategory,
  type SaleCategory,
  type EquipmentSaleCategory,
} from "@/lib/salary-coefficients-shared";

type SalaryCoefficientsClientProps = {
  slug: string;
  crew?: FranchizeCrewVM | any;
};

const RENTAL_CAT_KEYS: RentalCategory[] = [
  "budget",
  "regular",
  "partner_regular",
  "premium",
  "partner_premium",
];
const SALE_CAT_KEYS: SaleCategory[] = ["enduro_moped", "regular", "premium"];
const EQUIP_SALE_KEYS: EquipmentSaleCategory[] = ["helmet", "balaclava", "jacket", "pants", "gloves"];

const RENTAL_CAT_ACCENTS: Record<RentalCategory, string> = {
  budget: "#94a3b8",
  regular: "#3b82f6",
  partner_regular: "#8b5cf6",
  premium: "#f59e0b",
  partner_premium: "#ec4899",
};

const OFFICIAL_BIKE_MAP = getDefaultBikeCategories();

function rub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

export function SalaryCoefficientsClient({ slug, crew }: SalaryCoefficientsClientProps) {
  const { dbUser } = useAppContext();

  useFranchizeTheme(crew?.theme || fallbackCrew.theme);
  const T = useCrewTokens(crew?.theme || fallbackCrew.theme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [isOwner, setIsOwner] = useState(false);
  const [config, setConfig] = useState<SalaryConfig>(OFFICIAL_SALARY_CONFIG);
  const [bikes, setBikes] = useState<SalaryBikeRow[]>([]);
  const [savedConfig, setSavedConfig] = useState<SalaryConfig>(OFFICIAL_SALARY_CONFIG);
  const [savedBikes, setSavedBikes] = useState<SalaryBikeRow[]>([]);

  // Preview calculator state
  const [previewBikeId, setPreviewBikeId] = useState<string>("");
  const [previewEquipUnits, setPreviewEquipUnits] = useState(1);
  const [previewPrice, setPreviewPrice] = useState(12000);

  // Bike search
  const [bikeSearch, setBikeSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getSalaryCoefficientsConfig({ slug });
      if (result.success && result.data) {
        setConfig(result.data.config);
        setSavedConfig(result.data.config);
        setBikes(result.data.bikes);
        setSavedBikes(result.data.bikes);
        setIsOwner(result.data.isOwner);
        if (result.data.bikes[0]) {
          setPreviewBikeId((prev) => prev || result.data!.bikes[0].bikeId);
        }
      } else {
        setError(result.error || "Не удалось загрузить коэффициенты");
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () =>
      JSON.stringify(config) !== JSON.stringify(savedConfig) ||
      JSON.stringify(bikes) !== JSON.stringify(savedBikes),
    [config, savedConfig, bikes, savedBikes],
  );

  // ── Config setters ──
  const setRentalCoef = (cat: RentalCategory, value: string) =>
    setConfig((c) => ({ ...c, rental: { ...c.rental, [cat]: Number(value) || 0 } }));
  const setEquipRentalUnit = (value: string) =>
    setConfig((c) => ({ ...c, equipmentRentalUnit: Number(value) || 0 }));
  const setSaleCoef = (cat: SaleCategory, value: string) =>
    setConfig((c) => ({ ...c, sale: { ...c.sale, [cat]: Number(value) || 0 } }));
  const setEquipSaleCoef = (cat: EquipmentSaleCategory, value: string) =>
    setConfig((c) => ({ ...c, equipmentSale: { ...c.equipmentSale, [cat]: Number(value) || 0 } }));
  const setOverpricePercent = (value: string) =>
    setConfig((c) => ({ ...c, overpricePercent: Math.min(100, Math.max(0, Number(value) || 0)) }));

  const setBikeRentalCat = (bikeId: string, cat: RentalCategory) =>
    setBikes((bs) => bs.map((b) => (b.bikeId === bikeId ? { ...b, rentalCategory: cat } : b)));
  const setBikeSaleCat = (bikeId: string, cat: SaleCategory) =>
    setBikes((bs) => bs.map((b) => (b.bikeId === bikeId ? { ...b, saleCategory: cat } : b)));

  const applyOfficialBikeMapping = () => {
    setBikes((bs) =>
      bs.map((b) => {
        const def = OFFICIAL_BIKE_MAP[b.bikeId];
        return def ? { ...b, rentalCategory: def.rental, saleCategory: def.sale } : b;
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await saveSalaryCoefficientsConfig({
        slug,
        config,
        bikeCategories: bikes.map((b) => ({
          bikeId: b.bikeId,
          rentalCategory: b.rentalCategory,
          saleCategory: b.saleCategory,
        })),
      });
      if (result.success) {
        setSavedConfig(config);
        setSavedBikes(bikes);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        setError(result.error || "Не удалось сохранить");
      }
    } catch (err: any) {
      setError(err?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Сбросить все коэффициенты к официальным значениям?")) return;
    setSaving(true);
    setError(null);
    try {
      const result = await resetSalaryCoefficientsToOfficial({ slug });
      if (result.success) {
        await load();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
      } else {
        setError(result.error || "Не удалось сбросить");
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Preview ──
  const previewBike = bikes.find((b) => b.bikeId === previewBikeId);
  const previewBreakdown = useMemo(() => {
    if (!previewBike) return null;
    const salary = computeRentalSalary({
      config,
      rentalCategory: previewBike.rentalCategory,
      equipmentUnits: previewEquipUnits,
      totalCost: previewPrice,
      // Preview: assume the catalog price is 10% below the input price so the
      // overprice line is visible; pure UI illustration.
      standardPrice: Math.round(previewPrice * 0.9),
    });
    const sale = computeSaleSalary({
      config,
      saleCategory: previewBike.saleCategory,
    });
    return { salary, sale };
  }, [previewBike, config, previewEquipUnits, previewPrice]);

  const filteredBikes = useMemo(() => {
    const q = bikeSearch.trim().toLowerCase();
    if (!q) return bikes;
    return bikes.filter((b) => b.name.toLowerCase().includes(q) || b.bikeId.toLowerCase().includes(q));
  }, [bikes, bikeSearch]);

  const onDefaultsCount = useMemo(() => bikes.filter((b) => !b.isOverridden).length, [bikes]);

  if (loading) {
    return (
      <FranchizeOperatorPanel>
        <div className="py-10 text-center text-sm" style={{ color: T.textMuted }}>
          Загрузка коэффициентов…
        </div>
      </FranchizeOperatorPanel>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <FranchizeOperatorPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide" style={{ color: T.accent }}>
                <Sparkles className="h-4 w-4" /> Коэффициенты ЗП
              </p>
              <h1 className="mt-2 text-2xl font-semibold" style={{ color: T.text }}>
                Официальная схема бонусов
              </h1>
              <p className="mt-2 max-w-2xl text-sm" style={{ color: T.textMuted }}>
                Фиксированные бонусы за закрытые аренды и продажи по категориям техники, за экип
                и процент с наценки (оверпрайс). Значения подставляются в колонки «ЗП Аренда» /
                «ЗП Продажа» аналитики и в расчёт зарплаты.
              </p>
            </div>
            {!isOwner && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: `color-mix(in srgb, ${T.textMuted} 15%, transparent)`, color: T.textMuted }}
              >
                <Lock className="h-3 w-3" /> Только просмотр
              </span>
            )}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Живой калькулятор ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Calculator className="h-4 w-4" style={{ color: T.accent }} /> Живой калькулятор
          </h2>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            Проверьте, как считается ЗП оператора: категория + экип + оверпрайс.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: T.textMuted }}>Техника</label>
              <select
                value={previewBikeId}
                onChange={(e) => setPreviewBikeId(e.target.value)}
                className={franchizeOperatorInputClassName}
                style={{ ...franchizeOperatorInputStyle, appearance: "auto" as any }}
              >
                {bikes.map((b) => (
                  <option key={b.bikeId} value={b.bikeId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: T.textMuted }}>Экип, единиц</label>
              <Input
                type="number"
                min={0}
                value={previewEquipUnits}
                onChange={(e) => setPreviewEquipUnits(Math.max(0, Number(e.target.value) || 0))}
                className={franchizeOperatorInputClassName}
                style={franchizeOperatorInputStyle}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: T.textMuted }}>Цена аренды, ₽</label>
              <Input
                type="number"
                min={0}
                step={500}
                value={previewPrice}
                onChange={(e) => setPreviewPrice(Math.max(0, Number(e.target.value) || 0))}
                className={franchizeOperatorInputClassName}
                style={franchizeOperatorInputStyle}
              />
            </div>
          </div>

          {previewBike && previewBreakdown && (
            <div
              className="mt-3 rounded-xl border p-3 text-sm"
              style={{
                borderColor: `color-mix(in srgb, ${T.accent} 25%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${T.accent} 5%, transparent)`,
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span style={{ color: T.textMuted }}>
                  {previewBike.name} ·{" "}
                  <span style={{ color: RENTAL_CAT_ACCENTS[previewBike.rentalCategory] }}>
                    {RENTAL_CATEGORY_LABELS[previewBike.rentalCategory]}
                  </span>
                </span>
                <span className="text-lg font-bold" style={{ color: T.accent }}>
                  {rub(previewBreakdown.salary.total)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: T.textMuted }}>
                <span>База: {rub(previewBreakdown.salary.base)}</span>
                <span>
                  Экип: {previewEquipUnits} × {rub(config.equipmentRentalUnit)} = {rub(previewBreakdown.salary.equipment)}
                </span>
                <span>
                  Оверпрайс {config.overpricePercent}%: {rub(previewBreakdown.salary.overprice)}
                </span>
                <span>Продажа этой техники: {rub(previewBreakdown.sale.total)}</span>
              </div>
            </div>
          )}
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Аренда ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Bike className="h-4 w-4" style={{ color: T.accent }} /> Бонусы за аренду
          </h2>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            Выплачивается за каждую закрытую аренду техники категории.
          </p>
          <div className="mt-3 space-y-2">
            {RENTAL_CAT_KEYS.map((cat) => (
              <CoefRow
                key={cat}
                T={T}
                disabled={!isOwner}
                accent={RENTAL_CAT_ACCENTS[cat]}
                label={RENTAL_CATEGORY_LABELS[cat]}
                hint={RENTAL_CATEGORY_DESCRIPTIONS[cat]}
                value={config.rental[cat]}
                official={OFFICIAL_SALARY_CONFIG.rental[cat]}
                onChange={(v) => setRentalCoef(cat, v)}
              />
            ))}
            <CoefRow
              T={T}
              disabled={!isOwner}
              accent="#10b981"
              label="Экип (за единицу)"
              hint="Шлемы, перчатки, куртка, штаны, ботинки, сет, рюкзак. Зарядка — бесплатно"
              value={config.equipmentRentalUnit}
              official={OFFICIAL_SALARY_CONFIG.equipmentRentalUnit}
              onChange={setEquipRentalUnit}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Продажа ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Tag className="h-4 w-4" style={{ color: T.accent }} /> Бонусы за продажу техники
          </h2>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            Выплачивается за каждую закрытую продажу техники категории.
          </p>
          <div className="mt-3 space-y-2">
            {SALE_CAT_KEYS.map((cat) => (
              <CoefRow
                key={cat}
                T={T}
                disabled={!isOwner}
                accent="#f59e0b"
                label={SALE_CATEGORY_LABELS[cat]}
                hint={
                  cat === "enduro_moped"
                    ? "Эндуро, электроэндуро, мопеды, скутеры, питбайки"
                    : cat === "regular"
                      ? "Дорожная техника"
                      : "Сиквенс, Харлей, Сузуки"
                }
                value={config.sale[cat]}
                official={OFFICIAL_SALARY_CONFIG.sale[cat]}
                onChange={(v) => setSaleCoef(cat, v)}
              />
            ))}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Продажа экипировки ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Shirt className="h-4 w-4" style={{ color: T.accent }} /> Бонусы за продажу экипировки
          </h2>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            За каждую проданную единицу экипировки.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EQUIP_SALE_KEYS.map((cat) => (
              <CoefRow
                key={cat}
                T={T}
                disabled={!isOwner}
                accent="#8b5cf6"
                label={EQUIPMENT_SALE_LABELS[cat]}
                value={config.equipmentSale[cat]}
                official={OFFICIAL_SALARY_CONFIG.equipmentSale[cat]}
                onChange={(v) => setEquipSaleCoef(cat, v)}
              />
            ))}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Оверпрайс ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <FranchizeOperatorPanel>
          <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
            <Percent className="h-4 w-4" style={{ color: T.accent }} /> Оверпрайс
          </h2>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            Процент от наценки, который получает оператор, если аренда продана дороже каталога
            (наценка = цена − стандартная цена каталога за период − стандартный экип).
          </p>
          <div className="mt-3">
            <CoefRow
              T={T}
              disabled={!isOwner}
              accent="#ef4444"
              label="Процент с наценки"
              suffix="%"
              value={config.overpricePercent}
              official={OFFICIAL_SALARY_CONFIG.overpricePercent}
              onChange={setOverpricePercent}
            />
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Категории техники ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <FranchizeOperatorPanel>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: T.text }}>
              <Sparkles className="h-4 w-4" style={{ color: T.accent }} /> Категории техники
            </h2>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={applyOfficialBikeMapping}
                className="rounded-full text-xs"
                style={{ borderColor: T.border, color: T.text }}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" /> Применить официальные
              </Button>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
            {onDefaultsCount > 0
              ? `${onDefaultsCount} технике назначены категории по умолчанию (из официального документа). Измените при необходимости.`
              : "Всем единицам техники назначены категории вручную."}
          </p>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: T.textFaint }} />
            <Input
              placeholder="Поиск техники…"
              value={bikeSearch}
              onChange={(e) => setBikeSearch(e.target.value)}
              className={`${franchizeOperatorInputClassName} pl-9`}
              style={franchizeOperatorInputStyle}
            />
          </div>

          <div className="mt-3 space-y-2">
            {filteredBikes.map((b) => (
              <div
                key={b.bikeId}
                className="flex flex-col gap-2 rounded-xl border p-2.5 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
              >
                <div className="min-w-0 sm:max-w-[45%]">
                  <p className="truncate text-sm font-medium" style={{ color: T.text }}>
                    {b.name}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: T.textFaint }}>
                    {b.bikeId}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.textMuted }}>
                      Аренда
                    </label>
                    <select
                      value={b.rentalCategory}
                      disabled={!isOwner}
                      onChange={(e) => setBikeRentalCat(b.bikeId, e.target.value as RentalCategory)}
                      className={`${franchizeOperatorInputClassName} h-9 px-2 text-xs`}
                      style={{ ...franchizeOperatorInputStyle, appearance: "auto" as any }}
                    >
                      {RENTAL_CAT_KEYS.map((c) => (
                        <option key={c} value={c}>
                          {RENTAL_CATEGORY_LABELS[c]} · {config.rental[c]} ₽
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.textMuted }}>
                      Продажа
                    </label>
                    <select
                      value={b.saleCategory}
                      disabled={!isOwner}
                      onChange={(e) => setBikeSaleCat(b.bikeId, e.target.value as SaleCategory)}
                      className={`${franchizeOperatorInputClassName} h-9 px-2 text-xs`}
                      style={{ ...franchizeOperatorInputStyle, appearance: "auto" as any }}
                    >
                      {SALE_CAT_KEYS.map((c) => (
                        <option key={c} value={c}>
                          {SALE_CATEGORY_LABELS[c]} · {config.sale[c]} ₽
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {filteredBikes.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: T.textMuted }}>
                Ничего не найдено
              </p>
            )}
          </div>
        </FranchizeOperatorPanel>
      </motion.div>

      {/* ── Sticky save bar ── */}
      {isOwner && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md"
          style={{
            borderColor: T.borderSoft,
            backgroundColor: `color-mix(in srgb, ${T.bg} 88%, transparent)`,
          }}
        >
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 text-xs" style={{ color: savedFlash ? "#22c55e" : T.textMuted }}>
              {savedFlash ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Сохранено
                </>
              ) : dirty ? (
                <>
                  <AlertCircle className="h-4 w-4" style={{ color: "#f59e0b" }} /> Есть несохранённые изменения
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Все изменения сохранены
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
                className="rounded-full"
                style={{ borderColor: T.border, color: T.text }}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Официальные
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="rounded-full font-semibold"
                style={{ backgroundColor: T.accent, color: T.accentContrast }}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 max-w-[92vw] rounded-lg px-4 py-2 text-xs font-medium shadow-lg"
          style={{ backgroundColor: "#ef4444", color: "#fff" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coefficient row (label + hint + ₽ input, official-value diff badge)
// ─────────────────────────────────────────────────────────────────────────────

function CoefRow(props: {
  T: any;
  disabled: boolean;
  accent: string;
  label: string;
  hint?: string;
  value: number;
  official: number;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  const { T, disabled, accent, label, hint, value, official, suffix, onChange } = props;
  const differs = Number(value) !== Number(official);
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-2.5"
      style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: T.text }}>
            {label}
            {differs && (
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
                  color: accent,
                }}
              >
                ≠ офиц. {official} {suffix || "₽"}
              </span>
            )}
          </p>
          {hint && <p className="mt-0.5 text-[11px] leading-snug" style={{ color: T.textFaint }}>{hint}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          type="number"
          min={0}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${franchizeOperatorInputClassName} w-28 text-right tabular-nums`}
          style={franchizeOperatorInputStyle}
        />
        <span className="text-xs font-medium" style={{ color: T.textMuted }}>
          {suffix || "₽"}
        </span>
      </div>
    </div>
  );
}
