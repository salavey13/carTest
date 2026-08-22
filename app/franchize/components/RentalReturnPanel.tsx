// /app/franchize/components/RentalReturnPanel.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

interface RentalReturnPanelProps {
  rentalId: string;
  crewSlug: string;
  contractKey?: string;
  bikeType: 'bike' | 'ebike';
  isOwner: boolean;
  theme: {
    palette: {
      borderSoft: string;
      textPrimary: string;
      textSecondary: string;
      bgCard: string;
      accentMain: string;
    };
  };
}

export function RentalReturnPanel({
  rentalId,
  crewSlug,
  contractKey,
  bikeType,
  isOwner,
  theme,
}: RentalReturnPanelProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [returnData, setReturnData] = useState({
    damage_notes_at_return: '',
    battery_level_end: bikeType === 'ebike' ? '' : undefined,
    odometer_end_km: '',
    fuel_level_end: bikeType === 'bike' ? '' : undefined,
  });

  if (!contractKey) {
    return null;
  }

  if (!isOwner) {
    return (
      <section
        className="mt-4 rounded-2xl border p-4"
        style={{
          borderColor: theme.palette.borderSoft,
          backgroundColor: `${theme.palette.bgCard}CC`,
        }}
      >
        <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.palette.textSecondary }}>
          Завершение аренды
        </p>
        <p className="mt-2 text-sm" style={{ color: theme.palette.textSecondary }}>
          Только владелец экипажа может обновить договор при возврате техники.
        </p>
      </section>
    );
  }

  const handleSubmit = () => {
    if (!dbUser?.user_id) {
      toast.error('Требуется авторизация');
      return;
    }

    if (!returnData.damage_notes_at_return) {
      toast.error('Опишите состояние техники при возврате');
      return;
    }

    startTransition(async () => {
      // This would call a finalize rental return action (to be implemented)
      // For now, just show a success message
      toast.success('Функция завершения аренды будет реализована в следующей версии.');
    });
  };

  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{
        borderColor: theme.palette.borderSoft,
        backgroundColor: `${theme.palette.bgCard}CC`,
      }}
    >
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.palette.textSecondary }}>
        Завершение аренды
      </p>
      <h3 className="mt-1 text-base font-semibold" style={{ color: theme.palette.textPrimary }}>
        Документация возврата техники
      </h3>
      <p className="mt-1 text-sm" style={{ color: theme.palette.textSecondary }}>
        Зафиксируйте состояние и пробег при возврате для обновления договора.
      </p>

      <div className="mt-3 space-y-3 text-sm">
        <div className="space-y-2">
          <p className="font-medium">Данные при возврате</p>
          <input
            type="number"
            placeholder="Пробег при возврате (км)"
            value={returnData.odometer_end_km}
            onChange={(e) => setReturnData(prev => ({
              ...prev,
              odometer_end_km: e.target.value
            }))}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
          {bikeType === 'ebike' && (
            <input
              type="text"
              placeholder="Заряд батареи при возврате (%)"
              value={returnData.battery_level_end}
              onChange={(e) => setReturnData(prev => ({
                ...prev,
                battery_level_end: e.target.value
              }))}
              className="w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
            />
          )}
          {bikeType === 'bike' && (
            <input
              type="text"
              placeholder="Уровень топлива при возврате"
              value={returnData.fuel_level_end}
              onChange={(e) => setReturnData(prev => ({
                ...prev,
                fuel_level_end: e.target.value
              }))}
              className="w-full rounded-lg border px-2 py-1.5"
              style={{ borderColor: theme.palette.borderSoft }}
            />
          )}
          <textarea
            placeholder="Состояние при возврате (повреждения, замечания)"
            value={returnData.damage_notes_at_return}
            onChange={(e) => setReturnData(prev => ({
              ...prev,
              damage_notes_at_return: e.target.value
            }))}
            rows={3}
            className="w-full rounded-lg border px-2 py-1.5"
            style={{ borderColor: theme.palette.borderSoft }}
          />
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: theme.palette.accentMain,
            color: '#16130A',
          }}
        >
          {isPending ? 'Обработка...' : '📝 Обновить договор возвратом'}
        </button>
      </div>
    </section>
  );
}
