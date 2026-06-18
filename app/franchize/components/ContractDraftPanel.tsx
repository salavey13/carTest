// /app/franchize/components/ContractDraftPanel.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { submitContractDraft, type FranchizeTheme } from "../actions";

interface ContractDraftPanelProps {
  rentalId: string;
  crewSlug: string;
  bikeId: string;
  bikeTitle: string;
  bikeType: 'bike' | 'ebike';
  dates?: {
    start: string;
    startTime: string;
    end: string;
    endTime: string;
  };
  userId: string;
  isRenter: boolean;
  theme: FranchizeTheme;
}

export function ContractDraftPanel({
  rentalId,
  crewSlug,
  bikeId,
  bikeTitle,
  bikeType,
  dates,
  userId,
  isRenter,
  theme,
}: ContractDraftPanelProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    renterData: {
      full_name: '',
      passport: '',
      passport_issue_date: '',
      registration: '',
      birth_date: '',
      driver_license: '',
      phone: '',
      email: '',
    },
    equipmentData: {
      keys_count: 1,
      helmets_count: 1,
      charger: bikeType === 'ebike',
      lock: true,
      other_equipment: '',
    },
    pickupData: {
      odometer_km: '',
      fuel_level: bikeType === 'bike' ? '' : undefined,
      battery_start: bikeType === 'ebike' ? '100' : undefined,
      damage_notes_at_delivery: '',
    },
  });

  const canSubmit = isRenter && !isPending;

  const handleSubmit = () => {
    if (!dbUser?.user_id) {
      toast.error('Требуется авторизация');
      return;
    }

    // Validate required fields
    if (!formData.renterData.full_name || !formData.renterData.passport) {
      toast.error('Заполните ФИО и паспортные данные');
      return;
    }

    if (!formData.pickupData.odometer_km) {
      toast.error('Укажите пробег');
      return;
    }

    startTransition(async () => {
      const result = await submitContractDraft({
        rentalId,
        crewSlug,
        bikeId,
        renterData: formData.renterData,
        equipmentData: formData.equipmentData,
        pickupData: {
          ...formData.pickupData,
          odometer_km: Number(formData.pickupData.odometer_km),
        },
        actorTelegramUserId: dbUser.user_id,
      });

      if (!result.success) {
        toast.error(result.error || 'Не удалось отправить запрос');
        return;
      }

      toast.success('Запрос на договор отправлен владельцу техники!');
    });
  };

  if (!isRenter) return null;

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{
        borderColor: theme.palette.borderSoft,
        backgroundColor: `${theme.palette.bgCard}CC`,
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.palette.textSecondary }}>
        Договор аренды
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: theme.palette.textPrimary }}>
        Заполните данные для договора
      </h3>
      <p className="mt-1 text-sm" style={{ color: theme.palette.textSecondary }}>
        {bikeTitle} • {dates?.start} — {dates?.end}
      </p>

      <div className="mt-3 space-y-3 text-sm">
        {/* Renter Data Section */}
        <div className="space-y-2">
          <p className="font-medium">Данные арендатора</p>
          <input
            type="text"
            placeholder="ФИО полностью"
            value={formData.renterData.full_name}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, full_name: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          <input
            type="text"
            placeholder="Паспорт (серия номер)"
            value={formData.renterData.passport}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, passport: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          <input
            type="text"
            placeholder="Телефон"
            value={formData.renterData.phone}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, phone: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.renterData.email}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              renterData: { ...prev.renterData, email: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
        </div>

        {/* Equipment Section */}
        <div className="space-y-2">
          <p className="font-medium">Оборудование</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={formData.equipmentData.keys_count}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  equipmentData: { ...prev.equipmentData, keys_count: Number(e.target.value) || 0 }
                }))}
                className="w-16 rounded-lg border px-2 py-1.5"
                style={{ borderColor: theme.palette.borderSoft }}
              />
              <span>ключей</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={formData.equipmentData.helmets_count}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  equipmentData: { ...prev.equipmentData, helmets_count: Number(e.target.value) || 0 }
                }))}
                className="w-16 rounded-lg border px-2 py-1.5"
                style={{ borderColor: theme.palette.borderSoft }}
              />
              <span>шлемов</span>
            </label>
          </div>
          {bikeType === 'ebike' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.equipmentData.charger}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  equipmentData: { ...prev.equipmentData, charger: e.target.checked }
                }))}
              />
              <span>Зарядка</span>
            </label>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.equipmentData.lock}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                equipmentData: { ...prev.equipmentData, lock: e.target.checked }
              }))}
            />
            <span>Замок</span>
          </label>
        </div>

        {/* Pickup Data Section */}
        <div className="space-y-2">
          <p className="font-medium">Данные при выдаче</p>
          <input
            type="number"
            placeholder="Пробег (км)"
            value={formData.pickupData.odometer_km}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              pickupData: { ...prev.pickupData, odometer_km: e.target.value }
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          {bikeType === 'ebike' && (
            <input
              type="text"
              placeholder="Заряд батареи при выдаче (%)"
              value={formData.pickupData.battery_start}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                pickupData: { ...prev.pickupData, battery_start: e.target.value }
              }))}
              className="w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
            />
          )}
          <textarea
            placeholder="Примечания при выдаче (повреждения, состояние)"
            value={formData.pickupData.damage_notes_at_delivery}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              pickupData: { ...prev.pickupData, damage_notes_at_delivery: e.target.value }
            }))}
            rows={3}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
        </div>

        <button
          type="button"
          disabled={isPending || !canSubmit}
          onClick={handleSubmit}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: theme.palette.accentMain,
            color: '#16130A',
          }}
        >
          {isPending ? 'Отправляем...' : '📄 Отправить на утверждение'}
        </button>
      </div>
    </section>
  );
}
