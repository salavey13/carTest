// /app/franchize/components/ContractDraftReview.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { approveContract, declineContract, type FranchizeTheme } from "../actions";

interface ContractDraftReviewProps {
  rental: any;
  draft: any;
  bike: any;
  crewSlug: string;
  orgSecrets: any;
  theme: FranchizeTheme;
}

export function ContractDraftReview({
  rental,
  draft,
  bike,
  crewSlug,
  orgSecrets,
  theme,
}: ContractDraftReviewProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();

  // Simple owner check (in production, verify against crew_members table)
  const isOwner = Boolean(dbUser && rental.crew?.owner_id === dbUser.user_id);

  const handleApprove = () => {
    if (!dbUser?.user_id || !isOwner) {
      toast.error('Только владелец экипажа может утвердить договор');
      return;
    }

    startTransition(async () => {
      const result = await approveContract({
        rentalId: rental.rental_id,
        crewSlug,
        bikeId: bike.id,
        contractDraftId: `draft-${rental.rental_id}-${new Date(draft.submitted_at).getTime()}`,
        actorTelegramUserId: dbUser.user_id,
      });

      if (result.success) {
        toast.success('Договор утвержден и отправлен!');
        // Optionally redirect or refresh
      } else {
        toast.error(result.error || 'Ошибка при утверждении');
      }
    });
  };

  const handleDecline = () => {
    if (!dbUser?.user_id || !isOwner) {
      toast.error('Только владелец экипажа может отклонить запрос');
      return;
    }

    const reason = prompt('Причина отклонения (опционально):');

    startTransition(async () => {
      const result = await declineContract({
        rentalId: rental.rental_id,
        contractDraftId: `draft-${rental.rental_id}-${new Date(draft.submitted_at).getTime()}`,
        reason: reason || undefined,
        actorTelegramUserId: dbUser.user_id,
      });

      if (result.success) {
        toast.success('Запрос отклонен. Арендатор уведомлен.');
      } else {
        toast.error(result.error || 'Ошибка при отклонении');
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: theme.palette.textPrimary }}>
        Запрос на договор аренды
      </h1>

      {/* Renter Info */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Данные арендатора</h2>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-gray-500">ФИО:</dt><dd>{draft.renterData.full_name}</dd></div>
          <div><dt className="text-gray-500">Паспорт:</dt><dd>{draft.renterData.passport}</dd></div>
          {draft.renterData.driver_license && (
            <div><dt className="text-gray-500">Водительское удостоверение:</dt><dd>{draft.renterData.driver_license}</dd></div>
          )}
          {draft.renterData.phone && (
            <div><dt className="text-gray-500">Телефон:</dt><dd>{draft.renterData.phone}</dd></div>
          )}
          {draft.renterData.email && (
            <div><dt className="text-gray-500">Email:</dt><dd>{draft.renterData.email}</dd></div>
          )}
        </dl>
      </section>

      {/* Equipment */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Выданное оборудование</h2>
        <ul className="text-sm space-y-1">
          <li>🔑 Ключи: {draft.equipmentData.keys_count} шт.</li>
          <li>⛑ Шлемы: {draft.equipmentData.helmets_count} шт.</li>
          {draft.equipmentData.charger && <li>🔌 Зарядка</li>}
          {draft.equipmentData.lock && <li>🔒 Замок</li>}
          {draft.equipmentData.other_equipment && <li>📦 {draft.equipmentData.other_equipment}</li>}
        </ul>
      </section>

      {/* Pickup Conditions */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Состояние при выдаче</h2>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-gray-500">Пробег:</dt><dd>{draft.pickupData.odometer_km} км</dd></div>
          {draft.pickupData.fuel_level && (
            <div><dt className="text-gray-500">Уровень топлива:</dt><dd>{draft.pickupData.fuel_level}</dd></div>
          )}
          {draft.pickupData.battery_start && (
            <div><dt className="text-gray-500">Заряд батареи:</dt><dd>{draft.pickupData.battery_start}%</dd></div>
          )}
          {draft.pickupData.checklist && draft.pickupData.checklist.length > 0 && (
            <div><dt className="text-gray-500">Чеклист:</dt><dd>{draft.pickupData.checklist.join(', ')}</dd></div>
          )}
          {draft.pickupData.damage_notes_at_delivery && (
            <div><dt className="text-gray-500">Примечания:</dt><dd className="whitespace-pre-wrap">{draft.pickupData.damage_notes_at_delivery}</dd></div>
          )}
        </dl>
      </section>

      {/* Bike Info */}
      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgCard }}
      >
        <h2 className="font-semibold mb-3">Транспортное средство</h2>
        <p className="text-lg font-semibold">{bike.make} {bike.model}</p>
        <p className="text-sm text-gray-500">
          {rental.agreed_start_date || rental.requested_start_date} — {rental.agreed_end_date || rental.requested_end_date}
        </p>
      </section>

      {/* Actions */}
      {isOwner && (
        <div className="flex gap-3">
          <button
            disabled={isPending}
            onClick={handleApprove}
            className="flex-1 rounded-lg px-4 py-3 font-semibold text-white"
            style={{ backgroundColor: '#22c55e', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? 'Обработка...' : '✓ Утвердить и создать договор'}
          </button>
          <button
            disabled={isPending}
            onClick={handleDecline}
            className="flex-1 rounded-lg px-4 py-3 font-semibold text-white"
            style={{ backgroundColor: '#ef4444', opacity: isPending ? 0.7 : 1 }}
          >
            ✗ Отклонить
          </button>
        </div>
      )}

      {!isOwner && (
        <p className="text-sm text-gray-500 text-center">
          Только владелец экипажа может утверждать или отклонять запросы на договор.
        </p>
      )}
    </div>
  );
}
