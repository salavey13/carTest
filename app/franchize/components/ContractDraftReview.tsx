// /app/franchize/components/ContractDraftReview.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { approveContract, declineContract, type FranchizeTheme } from "../actions";
import { RentalReturnPanel } from "./RentalReturnPanel";

interface ContractDraftReviewProps {
  rental: any;
  draft: any;
  bike: any;
  crewSlug: string;
  orgSecrets: any;
  theme: FranchizeTheme;
  contractKey?: string;
  downloadUrl?: string;
}

type ContractStatus = 'pending' | 'approved' | 'declined';

export function ContractDraftReview({
  rental,
  draft,
  bike,
  crewSlug,
  orgSecrets,
  theme,
  contractKey,
  downloadUrl,
}: ContractDraftReviewProps) {
  const { dbUser } = useAppContext();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ContractStatus>(draft?.status || 'pending');
  const [showQr, setShowQr] = useState(false);

  // Simple owner check
  const isOwner = Boolean(dbUser && rental.crew?.owner_id === dbUser.user_id);
  const bikeType = (bike?.specs?.type || bike?.type || '').toLowerCase().includes('electric') ? 'ebike' : 'bike';

  // Generate QR code URL - points back to this page for user to fill final data
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || '';
  const qrLink = `${baseUrl}/franchize/${crewSlug}/contract-draft/${rental.rental_id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrLink)}`;

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
        setStatus('approved');
        toast.success('Договор утвержден и отправлен!');
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
        setStatus('declined');
        toast.success('Запрос отклонен. Арендатор уведомлен.');
      } else {
        toast.error(result.error || 'Ошибка при отклонении');
      }
    });
  };

  // Status badge component
  const StatusBadge = () => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      declined: 'bg-red-100 text-red-800',
    };
    const labels = {
      pending: 'Ожидает утверждения',
      approved: 'Утвержден',
      declined: 'Отклонен',
    };

    return (
      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${colors[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const isRentalActive = rental.status === 'active' || rental.status === 'confirmed';
  const isRentalEnded = rental.status === 'completed' || rental.status === 'finished';

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: theme.palette.textPrimary }}>
          {status === 'pending' ? 'Запрос на договор аренды' : 'Договор аренды'}
        </h1>
        <StatusBadge />
      </div>

      {/* Declined state */}
      {status === 'declined' && (
        <section
          className="rounded-2xl border p-4 bg-red-50"
          style={{ borderColor: '#ef4444' }}
        >
          <p className="font-semibold text-red-800">Запрос на договор отклонен</p>
          <p className="text-sm text-red-600 mt-1">
            Свяжитесь с владельцем техники для уточнения деталей.
          </p>
        </section>
      )}

      {/* Approved state with download link and QR */}
      {status === 'approved' && downloadUrl && (
        <section
          className="rounded-2xl border p-4 bg-green-50"
          style={{ borderColor: '#22c55e' }}
        >
          <p className="font-semibold text-green-800">✓ Договор утвержден и создан!</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <a
              href={downloadUrl}
              download
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-green-600 hover:bg-green-700"
            >
              📥 Скачать договор
            </a>
            <button
              onClick={() => setShowQr(!showQr)}
              className="px-4 py-2 text-sm font-semibold rounded-lg border-2 border-green-600 text-green-700 hover:bg-green-50"
            >
              {showQr ? 'Скрыть QR' : '📱 Показать QR для клиента'}
            </button>
          </div>

          {showQr && (
            <div className="mt-4 flex flex-col items-center">
              <img src={qrUrl} alt="QR Code" className="rounded-lg border-4 border-white shadow-lg" />
              <p className="mt-3 text-sm text-center text-gray-600">
                Отсканируйте QR код для заполнения финальных данных и подписи
              </p>
              <p className="text-xs text-center text-gray-500 mt-1">
                {qrLink}
              </p>
            </div>
          )}
        </section>
      )}

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
        <p className="text-xs text-gray-400 mt-1">Статус аренды: {rental.status}</p>
      </section>

      {/* Return data section (for active or completed rentals) */}
      {(isRentalActive || isRentalEnded) && contractKey && (
        <RentalReturnPanel
          rentalId={rental.rental_id}
          crewSlug={crewSlug}
          contractKey={contractKey}
          bikeType={bikeType}
          isOwner={isOwner}
          theme={theme}
        />
      )}

      {/* Actions for pending state */}
      {status === 'pending' && (
        <>
          {isOwner ? (
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
          ) : (
            <p className="text-sm text-gray-500 text-center">
              Только владелец экипажа может утверждать или отклонять запросы на договор.
            </p>
          )}
        </>
      )}

      {/* Info for non-owners when approved */}
      {status === 'approved' && !isOwner && (
        <p className="text-sm text-gray-500 text-center">
          Договор уже утвержден. Вы можете скачать его по ссылке выше.
        </p>
      )}
    </div>
  );
}
