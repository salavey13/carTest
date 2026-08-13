// app/franchize/[slug]/commissions/CommissionsClient.tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Percent, DollarSign } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

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
  { value: "rental_hourly", label: "Аренда (почасовая)" },
  { value: "rental_daily", label: "Аренда (дневная)" },
  { value: "sale", label: "Продажа" },
  { value: "equipment_rental", label: "Аренда экипировки" },
  { value: "service", label: "Сервис" },
];

export function CommissionsClient({ slug, crew }: CommissionsClientProps) {
  const { dbUser } = useAppContext();
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

  const T = crew?.theme?.palette || {
    bg: "#0B0C10",
    bgCard: "#111217",
    borderSoft: "#24262E",
    text: "#F2F2F3",
    textMuted: "#A7ABB4",
    accent: "#D99A00",
    accentContrast: "#16130A",
  };

  const isOwner = crew?.ownerId === dbUser?.user_id;

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

    const value = Number(form.commissionValue);
    if (value <= 0) {
      setFormError("Значение должно быть больше 0");
      return;
    }
    if (form.commissionType === "percentage" && value > 100) {
      setFormError("Процент не может превышать 100");
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
        setForm({ operationType: "rental_hourly", commissionType: "percentage", commissionValue: "", priority: "0" });
        loadRates();
      } else {
        setFormError(result.error || "Ошибка при сохранении");
      }
    } catch (err: any) {
      setFormError(err.message || "Ошибка при сохранении");
    }
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

  const getOperationLabel = (type: string) => {
    const found = OPERATION_TYPES.find((t) => t.value === type);
    return found?.label || type;
  };

  const activeRates = rates.filter((r) => r.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: T.text }}>Комиссии</h2>
          <p className="mt-1 text-sm" style={{ color: T.textMuted }}>Настройка ставок для расчёта вознаграждений</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors"
            style={{ background: T.accent, color: T.accentContrast }}
          >
            <Plus className="w-4 h-4" />
            Новая ставка
          </button>
        )}
      </div>

      {/* Rates Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent mx-auto" style={{ borderColor: T.accent }} />
        </div>
      ) : activeRates.length === 0 ? (
        <div className="text-center py-12 rounded-xl border" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <Percent className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: T.textMuted }} />
          <p className="text-lg font-medium" style={{ color: T.text }}>Нет ставок</p>
          <p className="text-sm mt-1" style={{ color: T.textMuted }}>Создайте первую ставку комиссии</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: `${T.borderSoft}20` }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Операция</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Значение</th>
                  <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Приоритет</th>
                  {isOwner && <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: T.textMuted }}>Действия</th>}
                </tr>
              </thead>
              <tbody>
                {activeRates.map((rate) => (
                  <tr key={rate.id} className="border-t" style={{ borderColor: T.borderSoft }}>
                    <td className="px-4 py-3 text-sm" style={{ color: T.text }}>
                      {getOperationLabel(rate.operationType)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                        style={{ background: `${T.accent}20`, color: T.accent }}
                      >
                        {rate.commissionType === "percentage" ? <Percent className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                        {rate.commissionType === "percentage" ? "Процент" : "Фиксированный"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: T.text }}>
                      {rate.commissionValue}
                      {rate.commissionType === "percentage" && "%"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: T.textMuted }}>{rate.priority}</td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(rate)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: T.textMuted }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeactivate(rate.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                            style={{ color: "#ef4444" }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && isOwner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl border max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ background: T.bgCard, borderColor: T.borderSoft }}>
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold" style={{ color: T.text }}>
                  {editingRate ? "Редактировать ставку" : "Новая ставка"}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingRate(null);
                    setFormError("");
                  }}
                  className="p-2 rounded-full transition-colors hover:bg-white/10"
                  style={{ color: T.textMuted }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpsert} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Операция</label>
                  <select
                    value={form.operationType}
                    onChange={(e) => setForm({ ...form, operationType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  >
                    {OPERATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Тип комиссии</label>
                  <select
                    value={form.commissionType}
                    onChange={(e) => setForm({ ...form, commissionType: e.target.value as "percentage" | "fixed_amount" })}
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  >
                    <option value="percentage">Процент (%)</option>
                    <option value="fixed_amount">Фиксированная сумма (₽)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>
                    Значение {form.commissionType === "percentage" ? "(%) : (₽)"}
                  </label>
                  <input
                    type="number"
                    value={form.commissionValue}
                    onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 rounded-xl border font-mono"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                    required
                  />
                  {form.commissionType === "percentage" && (
                    <p className="text-xs mt-1" style={{ color: T.textMuted }}>Максимум: 100%</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: T.text }}>Приоритет</label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    min="0"
                    className="w-full px-3 py-2 rounded-xl border"
                    style={{ background: T.bg, borderColor: T.borderSoft, color: T.text }}
                  />
                  <p className="text-xs mt-1" style={{ color: T.textMuted }}>Больший = применяется первым</p>
                </div>

                {formError && (
                  <div className="px-3 py-2 rounded-lg text-sm" style={{ background: "#ef444420", color: "#ef4444" }}>
                    {formError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl font-semibold transition-colors"
                    style={{ background: T.accent, color: T.accentContrast }}
                  >
                    {editingRate ? "Сохранить" : "Создать"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingRate(null);
                      setFormError("");
                    }}
                    className="px-4 py-2 rounded-xl font-semibold border transition-colors"
                    style={{ borderColor: T.borderSoft, color: T.text, background: "transparent" }}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Non-owner warning */}
      {!isOwner && (
        <div className="text-center py-8 rounded-xl border" style={{ background: `${T.borderSoft}10`, borderColor: T.borderSoft }}>
          <p className="text-sm" style={{ color: T.textMuted }}>Только владелец может настраивать комиссии</p>
        </div>
      )}
    </div>
  );
}


