"use client";

// ProfileDocumentsPanels — the three document-ish panels of the profile:
//   1. DocumentPhotosPanel   — «Мои документы»: photo uploads + verified data
//   2. RentalDocsPanel       — «Документы для аренды»: RentalDocsForm
//   3. FormPrefillsPanel     — «Данные для заявок»: callback form defaults
// Split out of ProfileClient in iter31 (verbatim behavior).

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CheckCircle, Lock } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { FranchizeOperatorPanel, franchizeOperatorInputClassName, franchizeOperatorInputStyle } from "@/app/franchize/components/FranchizeOperatorSurface";
import { RentalDocsForm } from "@/app/franchize/components/RentalDocsForm";
import { PhotoUploadButton } from "@/app/franchize/components/PhotoUploadButton";
import { withAlpha } from "@/app/franchize/lib/theme";
import type { FranchizeFormPrefill, } from "@/app/franchize/profile-actions";
import {
  getProfileDocsStatusAction,
  saveRentalDocsPrefillAction,
} from "@/app/franchize/profile-actions";
import type {
  ProfileDocsStatusState,
  RentalSecretsState,
  CrewTokens,
} from "./profile-shared";
import { itemVariants } from "./profile-shared";

export type RentalDocsPrefillState = {
  fullName?: string; phone?: string; birthDate?: string;
  passportSeries?: string; passportNumber?: string; passportIssuedBy?: string;
  passportIssueDate?: string; registrationAddress?: string;
  licenseSeries?: string; licenseNumber?: string; licenseCategories?: string;
  licenseExpiryDate?: string; verificationStatus?: string; hasVerifiedData?: boolean;
};

// ── 1. Document photos ───────────────────────────────────────────────────

function DocStatusBadge({
  uploaded,
  verified,
}: {
  uploaded: boolean;
  verified: boolean;
}) {
  if (verified) {
    return (
      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: withAlpha("#10b981", 0.15), color: "#10b981" }}>
        <CheckCircle className="h-3 w-3" />
        Верифицирован
      </span>
    );
  }
  if (uploaded) {
    return (
      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: withAlpha("#f59e0b", 0.15), color: "#f59e0b" }}>
        ⏳ Ожидает верификации
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: withAlpha("#ef4444", 0.15), color: "#ef4444" }}>
      ❌ Не загружен
    </span>
  );
}

function DocUploadSection({
  label,
  docType,
  status,
  userId,
  slug,
  onStatusRefresh,
  T,
}: {
  label: string;
  docType: "passport_mainpage" | "passport_registration" | "drivers_licence";
  status?: { uploaded: boolean; verified: boolean };
  userId: string;
  slug: string;
  onStatusRefresh: () => void;
  T: CrewTokens;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: T.text }}>
          {label}
        </span>
        <DocStatusBadge uploaded={!!status?.uploaded} verified={!!status?.verified} />
      </div>
      <PhotoUploadButton
        docType={docType}
        rentalId={`profile_${userId}`}
        chatId={userId}
        onSuccess={onStatusRefresh}
      />
      {status?.uploaded && !status?.verified && (
        <p className="text-xs italic" style={{ color: T.textMuted }}>
          Нельзя загрузить новое фото до верификации текущего
        </p>
      )}
    </div>
  );
}

export function DocumentPhotosPanel({
  slug,
  userId,
  docsPrefill,
  docsStatus,
  onDocsStatus,
  T,
}: {
  slug: string;
  userId: string | null;
  docsPrefill: RentalDocsPrefillState | null;
  docsStatus: ProfileDocsStatusState | null;
  onDocsStatus: (next: ProfileDocsStatusState) => void;
  T: CrewTokens;
}) {
  const refresh = () => {
    if (!userId) return;
    getProfileDocsStatusAction({ slug, userId }).then((res) => {
      if (res.success && res.data) onDocsStatus(res.data);
    });
  };

  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <VibeContentRenderer content="::FaCamera::" /> Мои документы
        </h2>
        <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
          Загрузите фото документов для ускорения оформления аренды. Данные будут распознаны автоматически.
        </p>

        {/* Verified renter data from previous rentals (e.g. collected by the
            operator via /doc and claimed through the rental QR code). The
            photo statuses below only reflect manual photo uploads — without
            this card a renter with fully verified /doc data saw "❌ Не
            загружен" everywhere and assumed his documents were lost. */}
        {docsPrefill?.hasVerifiedData && (
          <div
            className="mt-4 rounded-xl border p-3"
            style={{ borderColor: withAlpha("#10b981", 0.4), backgroundColor: withAlpha("#10b981", 0.06) }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: T.text }}>
                Проверенные данные арендатора
              </span>
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: withAlpha("#10b981", 0.15), color: "#10b981" }}
              >
                <CheckCircle className="h-3 w-3" />
                Верифицировано оператором
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: T.textMuted }}>
              Данные из вашей предыдущей аренды — при следующем заказе поля договора заполнятся автоматически.
            </p>
            <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2 max-sm:grid-cols-1">
              {docsPrefill.fullName && (
                <p><span style={{ color: T.textMuted }}>ФИО:</span> <span className="font-semibold" style={{ color: T.text }}>{docsPrefill.fullName}</span></p>
              )}
              {(docsPrefill.passportSeries || docsPrefill.passportNumber) && (
                <p>
                  <span style={{ color: T.textMuted }}>Паспорт:</span>{" "}
                  <span className="font-mono font-semibold" style={{ color: T.text }}>
                    {docsPrefill.passportSeries} {docsPrefill.passportNumber}
                  </span>
                </p>
              )}
              {docsPrefill.birthDate && (
                <p><span style={{ color: T.textMuted }}>Дата рождения:</span> <span className="font-semibold" style={{ color: T.text }}>{docsPrefill.birthDate}</span></p>
              )}
              {(docsPrefill.licenseSeries || docsPrefill.licenseNumber) && (
                <p>
                  <span style={{ color: T.textMuted }}>Вод. удостоверение:</span>{" "}
                  <span className="font-mono font-semibold" style={{ color: T.text }}>
                    {docsPrefill.licenseSeries} {docsPrefill.licenseNumber}
                  </span>
                  {docsPrefill.licenseCategories ? ` (кат. ${docsPrefill.licenseCategories})` : ""}
                </p>
              )}
              {docsPrefill.registrationAddress && (
                <p className="sm:col-span-2 max-sm:col-span-1"><span style={{ color: T.textMuted }}>Прописка:</span> <span style={{ color: T.text }}>{docsPrefill.registrationAddress}</span></p>
              )}
            </div>
            <p className="mt-2 text-[10px]" style={{ color: T.textMuted }}>
              Если данные изменились (замена паспорта/прав) — загрузите новые фото ниже или сообщите оператору при следующей аренде.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <DocUploadSection
            label="Паспорт (главная страница)"
            docType="passport_mainpage"
            status={docsStatus?.passportMainpage}
            userId={userId || ""}
            slug={slug}
            onStatusRefresh={refresh}
            T={T}
          />
          <DocUploadSection
            label="Паспорт (страница с пропиской)"
            docType="passport_registration"
            status={docsStatus?.passportRegistration}
            userId={userId || ""}
            slug={slug}
            onStatusRefresh={refresh}
            T={T}
          />
          <DocUploadSection
            label="Водительское удостоверение"
            docType="drivers_licence"
            status={docsStatus?.driversLicence}
            userId={userId || ""}
            slug={slug}
            onStatusRefresh={refresh}
            T={T}
          />
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}

// ── 2. Rental documents (RentalDocsForm) ─────────────────────────────────────

export function RentalDocsPanel({
  slug,
  userId,
  docsPrefill,
  rentalSecrets,
  T,
}: {
  slug: string;
  userId: string | null;
  docsPrefill: RentalDocsPrefillState | null;
  rentalSecrets: RentalSecretsState | null;
  T: CrewTokens;
}) {
  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <Lock className="h-4 w-4" /> Документы для аренды
        </h2>
        <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
          Заполните заранее — данные подставятся при оформлении. Проверяются оператором при первой аренде.
        </p>
        <div className="mt-3">
          {/* Verification status badge — text color is textPrimary so it
              stays readable in both light and dark themes (gold on gold
              washes out in light mode). */}
          {docsPrefill?.hasVerifiedData && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: withAlpha(T.accent, 0.35),
                backgroundColor: withAlpha(T.accent, 0.12),
                color: T.text,
              }}>
              <CheckCircle className="h-4 w-4" style={{ color: T.accent }} />
              <span>Документы верифицированы (завершённая аренда найдена)</span>
            </div>
          )}

          {/* Read-only summary of verified data from past rentals */}
          {rentalSecrets?.hasPreviousRentals && (
            <div className="mb-3 grid grid-cols-1 gap-1.5 text-xs " style={{ color: T.textMuted }}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  Паспорт: <span style={{ color: T.accent }}>
                    {rentalSecrets.savedData?.passport ? "✓ Сохранён" : "—"}
                  </span>
                </div>
                <div>
                  ВУ: <span style={{ color: T.accent }}>
                    {rentalSecrets.savedData?.driverLicense ? "✓ Сохранено" : "—"}
                  </span>
                </div>
                <div>
                  Дата рождения: <span style={{ color: T.accent }}>
                    {rentalSecrets.savedData?.birthDate || "—"}
                  </span>
                </div>
                <div>
                  Категории: <span style={{ color: T.accent }}>
                    {rentalSecrets.savedData?.licenseCategories || "—"}
                  </span>
                </div>
              </div>
              {rentalSecrets.lastRentalDate && (
                <div className="pt-0.5 opacity-60">
                  Последняя аренда: {rentalSecrets.lastRentalDate}
                </div>
              )}
            </div>
          )}

          {/* Editable form — only inside Telegram WebApp (not browser) */}
          {userId ? (
            <RentalDocsForm
              slug={slug}
              userId={userId}
              accentColor={T.accent}
              initialData={docsPrefill || undefined}
              onSave={async (data) => {
                return saveRentalDocsPrefillAction({ slug, userId, ...data });
              }}
            />
          ) : (
            <p className="py-4 text-center text-xs " style={{ color: T.textMuted }}>
              Откройте профиль в Telegram для ввода документов
            </p>
          )}
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}

// ── 3. Form prefills (callback request defaults) ─────────────────────────────

export function FormPrefillsPanel({
  prefill,
  onPrefillChange,
  onSave,
  isSaving,
  saveSuccess,
  T,
}: {
  prefill: FranchizeFormPrefill;
  onPrefillChange: (next: FranchizeFormPrefill) => void;
  onSave: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  T: CrewTokens;
}) {
  const accentOn = T.accentContrast;
  return (
    <motion.div variants={itemVariants}>
      <FranchizeOperatorPanel>
        <h2 className="flex items-center gap-2 text-base font-semibold " style={{ color: T.text }}>
          <VibeContentRenderer content="::FaClipboard::" /> Данные для заявок
        </h2>
        <p className="mt-1 text-xs " style={{ color: T.textMuted }}>
          Сохранённые данные будут автоматически подставляться в формы заявок
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input
            className={franchizeOperatorInputClassName}
            style={franchizeOperatorInputStyle}
            placeholder="ФИО"
            value={prefill.fullName}
            onChange={(e) => onPrefillChange({ ...prefill, fullName: e.target.value })}
          />
          <input
            className={franchizeOperatorInputClassName}
            style={franchizeOperatorInputStyle}
            placeholder="Телефон"
            value={prefill.phone}
            onChange={(e) => onPrefillChange({ ...prefill, phone: e.target.value })}
          />
          <input
            className={franchizeOperatorInputClassName}
            style={franchizeOperatorInputStyle}
            placeholder="Удобное время"
            value={prefill.preferredTime}
            onChange={(e) => onPrefillChange({ ...prefill, preferredTime: e.target.value })}
          />
          <input
            className={franchizeOperatorInputClassName}
            style={franchizeOperatorInputStyle}
            placeholder="Комментарий по умолчанию"
            value={prefill.comment}
            onChange={(e) => onPrefillChange({ ...prefill, comment: e.target.value })}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs " style={{ color: T.textMuted }}>
            Данные сохраняются локально для вашего аккаунта
          </p>
          <Button
            className="rounded-full font-semibold transition-all"
            disabled={isSaving}
            onClick={onSave}
            style={{
              backgroundColor: T.accent,
              color: accentOn,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Сохранение..." : saveSuccess ? "✓ Сохранено" : "Сохранить данные"}
          </Button>
        </div>
      </FranchizeOperatorPanel>
    </motion.div>
  );
}
