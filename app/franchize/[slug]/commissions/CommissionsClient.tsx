// app/franchize/[slug]/commissions/CommissionsClient.tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Percent, DollarSign, Copy, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import {
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "../../components/FranchizeOperatorSurface";
import { useFranchizeTheme } from "../../hooks/useFranchizeTheme";
import { useCrewTokens } from "../../lib/use-crew-tokens";
import { fallbackCrew } from "../../lib/fallback-crew";

interface CommissionRate {
  id: string;
  operationType: string;
  commissionType: "percentage" | "fixed_amount";
  commissionValue: number;
  priority: number;
  isActive: boolean;
}

interface CommissionsClientProps {
  slug: string;
  crew: any;
}

const OPERATION_TYPES = [
  { value: "rental_hourly", label: "Аренда (почасовая)", icon: "⏱️", color: "#3b82f6" },
  { value: "rental_daily", label: "Аренда (дневная)", icon: "📅", color: "#22c55e" },
  { value: "sale", label: "Продажа", icon: "🏷️", color: "#f59e0b" },
  { value: "equipment_rental", label: "Аренда экипировки", icon: "🪖", color: "#8b5cf6" },
  { value: "service", label: "Сервис", icon: "🔧", color: "#ef4444" },
];

// Preset commission rates for quick setup
const PRESET_RATES = [
  { operationType: "rental_hourly", commissionType: "percentage", commissionValue: 15, label: "15% с почасовой аренды" },
  { operationType: "rental_daily", commissionType: "percentage", commissionValue: 10, label: "10% с дневной аренды" },
  { operationType: "sale", commissionType: "percentage", commissionValue: 5, label: "5% с продаж" },
  { operationType: "equipment_rental", commissionType: "percentage", commissionValue: 20, label: "20% с экипировки" },
];

export function CommissionsClient({ slug, crew }: CommissionsClientProps) {
  const { dbUser, userCrewMemberships } = useAppContext();

  useFranchizeTheme(crew?.theme || fallbackCrew.theme);
  const T = useCrewTokens(crew?.theme || fallbackCrew.theme);

  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);

  const [form, setForm] = useState<{
    operationType: string;
    commissionType: "percentage" | "fixed_amount";
    commissionValue: string;
    priority: string;
  }>({
    operationType: "rental_hourly",
    commissionType: "percentage",
    commissionValue: "",
    priority: "0",
  });

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = userCrewMemberships.some(
    (m) => m.slug === slug && ["owner", "admin", "co_owner"].includes(m.role)
  );

  useEffect(() => {
    loadRates();
  }, [slug, dbUser?.user_id]);

  const loadRates = async () => {
    if (!dbUser?.user_id) return;

    try {
      const { getCommissionRates } = await import("../../server-actions/commissions");
      const result = await getCommissionRates({ slug, actorUserId: dbUser.user_id });

      if (result.success) {
        setRates(result.data || []);
      }
    } catch (err) {
      console.error("Failed to load commission rates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    const value = Number(form.commissionValue);
    if (value <= 0) {
      setFormError("Значение должно быть больше 0");
      setIsSubmitting(false);
      return;
    }
    if (form.commissionType === "percentage" && value > 100) {
      setFormError("Процент не может превышать 100");
      setIsSubmitting(false);
      return;
    }

    try {
      const { upsertCommissionRate } = await import("../../server-actions/commissions");
      const result = await upsertCommissionRate({
        slug,
        actorUserId: dbUser.user_id!,
        operationType: form.operationType,
        commissionType: form.commissionType,
        commissionValue: value,
        priority: Number(form.priority),
      });

      if (result.success) {
        setShowForm(false);
        setEditingRate(null);
        resetForm();
        loadRates();
      } else {
        setFormError(result.error || "Ошибка при сохранении");
      }
    } catch (err: any) {
      setFormError(err.message || "Ошибка при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({ operationType: "rental_hourly", commissionType: "percentage", commissionValue: "", priority: "0" });
    setFormError("");
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm("Деактивировать ставку?")) return;

    try {
      const { deactivateCommissionRate } = await import("../../server-actions/commissions");
      const result = await deactivateCommissionRate({
        slug,
        actorUserId: dbUser.user_id!,
        id,
      });

      if (result.success) {
        loadRates();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  const handleEdit = (rate: CommissionRate) => {
    setEditingRate(rate);
    setForm({
      operationType: rate.operationType,
      commissionType: rate.commissionType,
      commissionValue: String(rate.commissionValue),
      priority: String(rate.priority),
    });
    setShowForm(true);
  };

  const handleUsePreset = (preset: typeof PRESET_RATES[0]) => {
    setForm({
      operationType: preset.operationType,
      commissionType: preset.commissionType,
      commissionValue: String(preset.commissionValue),
      priority: "0",
    });
  };

  const handleDuplicate = (rate: CommissionRate) => {
    setForm({
      operationType: rate.operationType,
      commissionType: rate.commissionType,
      commissionValue: String(rate.commissionValue),
      priority: String(Number(rate.priority) + 1),
    });
    setEditingRate(null);
    setShowForm(true);
  };

  const getOperationLabel = (type: string) => {
    const found = OPERATION_TYPES.find((t) => t.value === type);
    return found;
  };

  const activeRates = rates.filter((r) => r.isActive).sort((a, b) => b.priority - a.priority);

  // Calculate stats
  const avgCommission = activeRates.length > 0
    ? activeRates
        .filter(r => r.commissionType === "percentage")
        .reduce((sum, r) => sum + r.commissionValue, 0) /
      activeRates.filter(r => r.commissionType === "percentage").length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <FranchizeOperatorPanel>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide" style={{ color: T.accent }}>
              <TrendingUp className="h-4 w-4" /> Комиссии
            </p>
            <h1 className="mt-2 text-2xl font-semibold" style={{ color: T.text }}>
              Настройка ставок вознаграждений
            </h1>
            <p className="mt-2 text-sm" style={{ color: T.textMuted }}>
              Определите проценты для расчёта комиссий райдеров
            </p>
            {/* FIX (iter4): explain that these rates drive the salary column
                in the CSV exports on the rentals/sales analytics pages. */}
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: `color-mix(in srgb, ${T.accent} 30%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${T.accent} 6%, transparent)`,
                color: T.textMuted,
              }}
            >
              <span className="font-semibold" style={{ color: T.text }}>Где это используется:</span>{" "}
              Ставка для «Аренда (дневная)» подставляется в колонку{" "}
              <span className="font-mono">ЗП Аренда</span> в CSV-выгрузке с аналитики аренд;
              ставка для «Продажа» — в колонку <span className="font-mono">ЗП Продажа</span>{" "}
              на странице продаж. При отсутствии дневной ставки используется почасовая.
            </div>
          </div>
          {isOwner && (
            <Button
              onClick={() => setShowForm(true)}
              className="shrink-0 rounded-full font-semibold"
              style={{ backgroundColor: T.accent, color: T.accentContrast }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Новая ставка
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <FranchizeOperatorStatCard
            label="Активных ставок"
            value={String(activeRates.length)}
            icon={<Percent className="h-4 w-4" style={{ color: T.accent }} />}
          />
          <FranchizeOperatorStatCard
            label="Средний %"
            value={`${avgCommission.toFixed(1)}%`}
            icon={<Sparkles className="h-4 w-4" style={{ color: "#22c55e" }} />}
          />
          <FranchizeOperatorStatCard
            label="Типов операций"
            value={String(new Set(activeRates.map(r => r.operationType)).size)}
            icon={<TrendingUp className="h-4 w-4" style={{ color: "#3b82f6" }} />}
          />
        </div>
      </FranchizeOperatorPanel>

      {/* Quick Presets */}
      {isOwner && activeRates.length === 0 && (
        <FranchizeOperatorPanel>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: T.text }}>
            <Sparkles className="h-4 w-4" /> Быстрый старт
          </h2>
          <p className="mb-3 text-xs" style={{ color: T.textMuted }}>
            Выберите пресет для быстрой настройки базовых комиссий
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRESET_RATES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  handleUsePreset(preset);
                  setShowForm(true);
                }}
                className="flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-white/5"
                style={{ borderColor: T.borderSoft }}
              >
                <span className="text-lg">{getOperationLabel(preset.operationType)?.icon}</span>
                <div className="flex-1">
                  <span className="text-xs font-medium" style={{ color: T.text }}>{preset.label}</span>
                </div>
                <Plus className="h-4 w-4 shrink-0" style={{ color: T.accent }} />
              </button>
            ))}
          </div>
        </FranchizeOperatorPanel>
      )}

      {/* Rates List */}
      <FranchizeOperatorPanel>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: T.text }}>
          <Percent className="h-4 w-4" /> Активные ставки
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: T.accent }} />
          </div>
        ) : activeRates.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${T.borderSoft}30` }}>
              <Percent className="h-6 w-6" style={{ color: T.textMuted }} />
            </div>
            <p className="text-sm font-medium" style={{ color: T.text }}>Нет ставок</p>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              {isOwner ? "Создайте первую ставку или используйте пресеты" : "Ставки ещё не настроены"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeRates.map((rate) => {
              const opInfo = getOperationLabel(rate.operationType);
              return (
                <div
                  key={rate.id}
                  className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{ background: `${T.borderSoft}10`, borderColor: T.borderSoft }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opInfo?.icon}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: T.text }}>{opInfo?.label}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ background: `${opInfo?.color}20`, color: opInfo?.color }}
                        >
                          {rate.commissionType === "percentage" ? (
                            <><Percent className="h-3 w-3" /> {rate.commissionValue}%</>
                          ) : (
                            <><DollarSign className="h-3 w-3" /> {rate.commissionValue} ₽</>
                          )}
                        </span>
                        {rate.priority > 0 && (
                          <span className="text-xs" style={{ color: T.textMuted }}>Приоритет: {rate.priority}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-2 sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicate(rate)}
                        className="h-8 px-2 text-xs"
                        style={{ color: T.textMuted }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(rate)}
                        className="h-8 px-2 text-xs"
                        style={{ color: T.accent }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeactivate(rate.id)}
                        className="h-8 px-2 text-xs"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FranchizeOperatorPanel>

      {/* Non-owner warning */}
      {!isOwner && (
        <div className="text-center py-6 rounded-xl border" style={{ background: `${T.borderSoft}10`, borderColor: T.borderSoft }}>
          <p className="text-sm" style={{ color: T.textMuted }}>Только владелец может настраивать комиссии</p>
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Редактировать ставку" : "Новая ставка"}
            </DialogTitle>
            <DialogDescription>
              {editingRate ? "Измените параметры ставки" : "Создайте новую ставку комиссии"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpsert} className="space-y-4">
            {/* Operation Type */}
            <div className="space-y-2">
              <Label htmlFor="operationType">Операция</Label>
              <div className="grid grid-cols-1 gap-2">
                {OPERATION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setForm({ ...form, operationType: type.value })}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                      form.operationType === type.value
                        ? "border-2"
                        : "hover:bg-white/5"
                    )}
                    style={{
                      borderColor: form.operationType === type.value ? type.color : T.borderSoft,
                      background: form.operationType === type.value ? `${type.color}15` : "transparent",
                    }}
                  >
                    <span className="text-xl">{type.icon}</span>
                    <span className="text-sm font-medium" style={{ color: T.text }}>{type.label}</span>
                    {form.operationType === type.value && (
                      <span className="ml-auto text-xs" style={{ color: type.color }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Commission Type */}
            <div className="space-y-2">
              <Label htmlFor="commissionType">Тип комиссии</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, commissionType: "percentage" })}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    form.commissionType === "percentage" ? "border-2" : "hover:bg-white/5"
                  )}
                  style={{
                    borderColor: form.commissionType === "percentage" ? T.accent : T.borderSoft,
                    background: form.commissionType === "percentage" ? `${T.accent}15` : "transparent",
                    color: T.text,
                  }}
                >
                  <Percent className="h-4 w-4" />
                  Процент
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, commissionType: "fixed_amount" })}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    form.commissionType === "fixed_amount" ? "border-2" : "hover:bg-white/5"
                  )}
                  style={{
                    borderColor: form.commissionType === "fixed_amount" ? T.accent : T.borderSoft,
                    background: form.commissionType === "fixed_amount" ? `${T.accent}15` : "transparent",
                    color: T.text,
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  Фикс
                </button>
              </div>
            </div>

            {/* Value and Priority in Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="commissionValue">
                  Значение {form.commissionType === "percentage" ? "(%)" : "(₽)"}
                </Label>
                <Input
                  id="commissionValue"
                  type="number"
                  value={form.commissionValue}
                  onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                  min="0"
                  step="0.01"
                  placeholder={form.commissionType === "percentage" ? "15" : "1000"}
                  className="font-mono"
                  required
                />
                {form.commissionType === "percentage" && (
                  <p className="text-xs" style={{ color: T.textMuted }}>Максимум: 100%</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет</Label>
                <Input
                  id="priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  min="0"
                  placeholder="0"
                />
                <p className="text-xs" style={{ color: T.textMuted }}>Больше = раньше</p>
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "#ef444420", color: "#ef4444" }}>
                {formError}
              </div>
            )}

            {/* Actions */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="rounded-full"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full font-semibold"
                style={{ backgroundColor: T.accent, color: T.accentContrast }}
              >
                {isSubmitting ? "Сохранение..." : editingRate ? "Сохранить" : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
