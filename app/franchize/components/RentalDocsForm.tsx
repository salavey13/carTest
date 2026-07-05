"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Lock, FileText, IdCard } from "lucide-react";

/**
 * RentalDocsForm — user-friendly passport + license input for self-service.
 *
 * Mirrors the /doc command's UX but as a web form:
 * - Example values shown inline (same format as operator sees)
 * - Progressive disclosure (passport first, then license)
 * - Saved to private.user_rental_secrets via server action
 * - Auto-fills from previous data if available
 *
 * Used on the profile page for pre-entering renter docs.
 */

interface RentalDocsFormProps {
  slug: string;
  userId: string;
  accentColor: string;
  initialData?: {
    fullName?: string;
    phone?: string;
    birthDate?: string;
    passportSeries?: string;
    passportNumber?: string;
    passportIssuedBy?: string;
    passportIssueDate?: string;
    registrationAddress?: string;
    licenseSeries?: string;
    licenseNumber?: string;
    licenseCategories?: string;
    licenseExpiryDate?: string;
    verificationStatus?: string;
    hasVerifiedData?: boolean;
  };
  onSave: (data: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
}

type Section = "passport" | "license";

export function RentalDocsForm({
  slug,
  userId,
  accentColor,
  initialData,
  onSave,
}: RentalDocsFormProps) {
  const [activeSection, setActiveSection] = useState<Section>("passport");
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(initialData?.hasVerifiedData ?? false);

  // Passport fields
  const [fullName, setFullName] = useState(initialData?.fullName ?? "");
  const [birthDate, setBirthDate] = useState(initialData?.birthDate ?? "");
  const [passportSeries, setPassportSeries] = useState(initialData?.passportSeries ?? "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber ?? "");
  const [passportIssueDate, setPassportIssueDate] = useState(initialData?.passportIssueDate ?? "");
  const [passportIssuedBy, setPassportIssuedBy] = useState(initialData?.passportIssuedBy ?? "");
  const [registrationAddress, setRegistrationAddress] = useState(initialData?.registrationAddress ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");

  // License fields
  const [licenseSeries, setLicenseSeries] = useState(initialData?.licenseSeries ?? "");
  const [licenseNumber, setLicenseNumber] = useState(initialData?.licenseNumber ?? "");
  const [licenseCategories, setLicenseCategories] = useState(initialData?.licenseCategories ?? "");
  const [licenseExpiryDate, setLicenseExpiryDate] = useState(initialData?.licenseExpiryDate ?? "");

  useEffect(() => {
    setIsVerified(initialData?.hasVerifiedData ?? false);
  }, [initialData]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await onSave({
        fullName, phone, birthDate,
        passportSeries, passportNumber, passportIssuedBy, passportIssueDate,
        registrationAddress,
        licenseSeries, licenseNumber, licenseCategories, licenseExpiryDate,
      });
      if (result.success) {
        setSavedAt(new Date().toLocaleTimeString("ru-RU"));
      } else {
        setError(result.error || "Не удалось сохранить");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setIsSaving(false);
    }
  };

  // Input style helper
  const inputClass = "w-full rounded-lg border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2";
  const inputStyle = { borderColor: `${accentColor}30`, backgroundColor: "rgba(0,0,0,0.2)" };
  const labelClass = "mb-1 block text-xs font-medium opacity-70";
  const exampleClass = "mt-0.5 text-[10px] opacity-50";

  return (
    <div className="space-y-4">
      {/* Verification badge */}
      {isVerified && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-300">
            Документы верифицированы (есть завершённая аренда)
          </span>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("passport")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeSection === "passport"
              ? "text-white"
              : "border opacity-60 hover:opacity-100"
          }`}
          style={activeSection === "passport"
            ? { backgroundColor: accentColor }
            : { borderColor: `${accentColor}40` }}
        >
          <FileText className="h-3.5 w-3.5" /> Паспорт
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("license")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            activeSection === "license"
              ? "text-white"
              : "border opacity-60 hover:opacity-100"
          }`}
          style={activeSection === "license"
            ? { backgroundColor: accentColor }
            : { borderColor: `${accentColor}40` }}
        >
          <IdCard className="h-3.5 w-3.5" /> Вод. удостоверение
        </button>
      </div>

      {/* Passport section */}
      {activeSection === "passport" && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>ФИО (полностью)</label>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="Иванов Иван Иванович"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Дата рождения</label>
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Серия паспорта</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="4509"
                maxLength={4}
                value={passportSeries}
                onChange={(e) => setPassportSeries(e.target.value.replace(/\D/g, ""))}
              />
              <p className={exampleClass}>4 цифры</p>
            </div>
            <div>
              <label className={labelClass}>Номер паспорта</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="123456"
                maxLength={6}
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value.replace(/\D/g, ""))}
              />
              <p className={exampleClass}>6 цифр</p>
            </div>
          </div>
          <div>
            <label className={labelClass}>Дата выдачи</label>
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={passportIssueDate}
              onChange={(e) => setPassportIssueDate(e.target.value)}
            />
            <p className={exampleClass}>Например: 15.03.2023</p>
          </div>
          <div>
            <label className={labelClass}>Кем выдан</label>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="ОМВД России по г. Нижнему Новгороду"
              value={passportIssuedBy}
              onChange={(e) => setPassportIssuedBy(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Адрес регистрации</label>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="г. Н. Новгород, ул. Ленина, д. 1, кв. 1"
              value={registrationAddress}
              onChange={(e) => setRegistrationAddress(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Телефон</label>
            <input
              type="tel"
              className={inputClass}
              style={inputStyle}
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Quick navigation */}
          <button
            type="button"
            onClick={() => setActiveSection("license")}
            className="text-xs font-medium transition hover:opacity-80"
            style={{ color: accentColor }}
          >
            Далее: Вод. удостоверение →
          </button>
        </div>
      )}

      {/* License section */}
      {activeSection === "license" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Серия ВУ</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="99"
                maxLength={2}
                value={licenseSeries}
                onChange={(e) => setLicenseSeries(e.target.value.replace(/\D/g, ""))}
              />
              <p className={exampleClass}>2 цифры</p>
            </div>
            <div>
              <label className={labelClass}>Номер ВУ</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="76 123456"
                maxLength={8}
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
              <p className={exampleClass}>Например: 76 123456</p>
            </div>
          </div>
          <div>
            <label className={labelClass}>Категории</label>
            <input
              className={inputClass}
              style={inputStyle}
              placeholder="A, A1, B, B1"
              value={licenseCategories}
              onChange={(e) => setLicenseCategories(e.target.value)}
            />
            <p className={exampleClass}>Через запятую. A — для мото, B — для легковых</p>
          </div>
          <div>
            <label className={labelClass}>Срок действия</label>
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={licenseExpiryDate}
              onChange={(e) => setLicenseExpiryDate(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={() => setActiveSection("passport")}
            className="text-xs font-medium transition hover:opacity-80"
            style={{ color: accentColor }}
          >
            ← Назад: Паспорт
          </button>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {savedAt && !error && (
        <div className="flex items-center gap-2 text-xs opacity-60">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Сохранено в {savedAt}</span>
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        style={{ backgroundColor: accentColor, color: "#fff" }}
      >
        <Lock className="h-3.5 w-3.5" />
        {isSaving ? "Сохраняем..." : "Сохранить документы"}
      </button>

      <p className="text-center text-[10px] opacity-50">
        🔒 Данные хранятся в зашифрованном виде и используются только для оформления аренды.
        Паспорт и ВУ проверяются оператором при первой аренде.
      </p>
    </div>
  );
}
