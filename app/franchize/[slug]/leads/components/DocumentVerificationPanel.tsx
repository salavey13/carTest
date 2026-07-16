"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, FileText, ShieldCheck, Check, X, Eye, ImageOff, RotateCcw, Camera, CheckCircle } from "lucide-react";
import { getRentalDocVerification, type DocVerificationData } from "@/app/franchize/server-actions/leads";
import type { LeadRentalRow } from "@/app/franchize/server-actions/leads";

interface DocumentVerificationPanelProps {
  rental: LeadRentalRow;
  slug: string;
  T: any;
}

export function DocumentVerificationPanel({ rental, slug, T }: DocumentVerificationPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocVerificationData | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const hasAnyPhoto = !!(rental.passportMainpagePhoto || rental.passportRegistrationPhoto || rental.driversLicenceFrontalPhoto);

  useEffect(() => {
    if (!rental.rentalId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const result = await getRentalDocVerification(rental.rentalId);
        if (cancelled) return;
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || "Не удалось загрузить данные");
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Ошибка сети");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [rental.rentalId]);

  const handleVerify = async (docType: "passport" | "license") => {
    if (!rental.rentalId) return;
    setVerifying(docType);
    setVerifyMsg(null);
    try {
      const updates: Record<string, any> = {};
      if (docType === "passport") {
        updates.passport_verified = true;
      } else {
        updates.license_verified = true;
      }

      const resp = await fetch("/api/verify-rental-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId: rental.rentalId, updates }),
      });
      const result = await resp.json();
      if (result.success) {
        setVerifyMsg({ ok: true, text: docType === "passport" ? "Паспорт верифицирован" : "Права верифицированы" });
        const refreshed = await getRentalDocVerification(rental.rentalId);
        if (refreshed.success && refreshed.data) {
          setData(refreshed.data);
        }
      } else {
        setVerifyMsg({ ok: false, text: result.error || "Ошибка верификации" });
      }
    } catch (err: any) {
      setVerifyMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setVerifying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: T.accent }} />
        <span className="ml-2 text-xs" style={{ color: T.textMuted }}>Загрузка документов...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: "#ef444440", backgroundColor: "#ef444410" }}>
        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#ef4444" }} />
        <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!hasAnyPhoto && !data.ocrData.fullName && !data.ocrData.passport && !data.ocrData.driverLicense) {
    return (
      <div className="rounded-xl border py-4 text-center" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <Camera className="mx-auto h-6 w-6 mb-2" style={{ color: T.textFaint }} />
        <p className="text-xs" style={{ color: T.textFaint }}>Документы не загружены</p>
        <p className="mt-1 text-[10px]" style={{ color: T.textFaint }}>Арендатор не загрузил фото документов</p>
      </div>
    );
  }

  const passportVerified = data?.checklist.passportVerified ?? false;
  const licenseVerified = data?.checklist.licenseVerified ?? false;
  const totalDocs = 2;
  const verifiedCount = [passportVerified, licenseVerified].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="rounded-xl border p-3" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold" style={{ color: T.text }}>
            <ShieldCheck className="inline h-3.5 w-3.5 mr-1" style={{ color: verifiedCount === 2 ? "#10b981" : T.accent }} />
            Верификация документов
          </span>
          <span className="text-[10px] font-bold" style={{ color: verifiedCount === 2 ? "#10b981" : T.textMuted }}>
            {verifiedCount}/2
          </span>
        </div>
        <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: T.borderSoft }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(verifiedCount / 2) * 100}%`,
              backgroundColor: verifiedCount === 2 ? "#10b981" : T.accent,
            }}
          />
        </div>
        {verifiedCount === 2 && (
          <p className="mt-1.5 text-[10px] font-medium text-center" style={{ color: "#10b981" }}>
            <Check className="inline h-3 w-3 mr-0.5" /> Все документы верифицированы
          </p>
        )}
      </div>

      {/* Verification message */}
      {verifyMsg && (
        <div className="rounded-xl border p-2.5 text-[11px] font-medium text-center"
          style={{
            borderColor: verifyMsg.ok ? "#10b98140" : "#ef444440",
            backgroundColor: verifyMsg.ok ? "#10b98110" : "#ef444410",
            color: verifyMsg.ok ? "#10b981" : "#ef4444",
          }}>
          {verifyMsg.ok ? <Check className="inline h-3.5 w-3.5 mr-1" /> : <AlertCircle className="inline h-3.5 w-3.5 mr-1" />}
          {verifyMsg.text}
        </div>
      )}

      {/* Passport section */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: passportVerified ? "#10b98110" : T.bgElevated }}>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: passportVerified ? "#10b981" : T.accent }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Паспорт</span>
            {passportVerified && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#10b98120", color: "#10b981" }}>
                <Check className="inline h-2.5 w-2.5 mr-0.5" />Верифицирован
              </span>
            )}
          </div>
          {!passportVerified && (data.photos.passportMainpage.signedUrl || data.photos.passportRegistration.signedUrl) && (
            <button
              onClick={() => handleVerify("passport")}
              disabled={verifying === "passport"}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "#10b981" }}
            >
              {verifying === "passport" ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />...</span>
              ) : (
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Верифицировать</span>
              )}
            </button>
          )}
        </div>

        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: T.border }}>
          {/* Passport photos */}
          <div className="grid grid-cols-2 gap-2">
            {/* Main page photo */}
            <div>
              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Главная страница</p>
              {data.photos.passportMainpage.signedUrl ? (
                <button onClick={() => setLightboxSrc(data.photos.passportMainpage.signedUrl)} className="block w-full">
                  <img
                    src={data.photos.passportMainpage.signedUrl}
                    alt="Паспорт (главная)"
                    className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                    style={{ borderColor: T.border }}
                  />
                  <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                    <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                  </p>
                </button>
              ) : data.photos.passportMainpage.path ? (
                <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                  <div className="text-center">
                    <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                    <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
                </div>
              )}
            </div>

            {/* Registration photo */}
            <div>
              <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Прописка</p>
              {data.photos.passportRegistration.signedUrl ? (
                <button onClick={() => setLightboxSrc(data.photos.passportRegistration.signedUrl)} className="block w-full">
                  <img
                    src={data.photos.passportRegistration.signedUrl}
                    alt="Паспорт (прописка)"
                    className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                    style={{ borderColor: T.border }}
                  />
                  <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                    <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                  </p>
                </button>
              ) : data.photos.passportRegistration.path ? (
                <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                  <div className="text-center">
                    <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                    <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
                </div>
              )}
            </div>
          </div>

          {/* OCR data */}
          {(data.ocrData.fullName || data.ocrData.passport || data.ocrData.birthDate || data.ocrData.registration) && (
            <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.textFaint }}>Данные OCR</p>
              {data.ocrData.fullName && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>ФИО:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.fullName}</span>
                </div>
              )}
              {data.ocrData.passport && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Паспорт:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.passport}</span>
                </div>
              )}
              {data.ocrData.passportIssuedBy && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Кем выдан:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.passportIssuedBy}</span>
                </div>
              )}
              {data.ocrData.passportIssueDate && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Дата выдачи:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.passportIssueDate}</span>
                </div>
              )}
              {data.ocrData.birthDate && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Дата рождения:</span>
                  <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.birthDate}</span>
                </div>
              )}
              {data.ocrData.registration && (
                <div className="flex items-start gap-1">
                  <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Регистрация:</span>
                  <span className="text-[10px] break-words" style={{ color: T.text }}>{data.ocrData.registration}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Driver's license section */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.bgElevated }}>
        <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: licenseVerified ? "#10b98110" : T.bgElevated }}>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" style={{ color: licenseVerified ? "#10b981" : T.accent }} />
            <span className="text-xs font-bold" style={{ color: T.text }}>Водительское удостоверение</span>
            {licenseVerified && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ backgroundColor: "#10b98120", color: "#10b981" }}>
                <Check className="inline h-2.5 w-2.5 mr-0.5" />Верифицировано
              </span>
            )}
          </div>
          {!licenseVerified && data.photos.driversLicence.signedUrl && (
            <button
              onClick={() => handleVerify("license")}
              disabled={verifying === "license"}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "#10b981" }}
            >
              {verifying === "license" ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />...</span>
              ) : (
                <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Верифицировать</span>
              )}
            </button>
          )}
        </div>

        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: T.border }}>
          {/* License photo */}
          <div>
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: T.textFaint }}>Водительское удостоверение</p>
            {data.photos.driversLicence.signedUrl ? (
              <button onClick={() => setLightboxSrc(data.photos.driversLicence.signedUrl)} className="block w-full">
                <img
                  src={data.photos.driversLicence.signedUrl}
                  alt="Водительское удостоверение"
                  className="w-full h-24 object-cover rounded-lg border transition hover:opacity-80"
                  style={{ borderColor: T.border }}
                />
                <p className="mt-0.5 text-[9px] text-center" style={{ color: T.textFaint }}>
                  <Eye className="inline h-2.5 w-2.5 mr-0.5" />Увеличить
                </p>
              </button>
            ) : data.photos.driversLicence.path ? (
              <div className="flex h-24 items-center justify-center rounded-lg border" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
                <div className="text-center">
                  <ImageOff className="mx-auto h-5 w-5 mb-1" style={{ color: T.textFaint }} />
                  <p className="text-[9px]" style={{ color: T.textFaint }}>Фото удалено</p>
                </div>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed" style={{ borderColor: T.border }}>
                <p className="text-[9px]" style={{ color: T.textFaint }}>Не загружено</p>
              </div>
            )}
          </div>

          {/* OCR data */}
          {data.ocrData.driverLicense && (
            <div className="rounded-lg border p-2 space-y-1" style={{ borderColor: T.border, backgroundColor: T.bgCard }}>
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: T.textFaint }}>Данные OCR</p>
              <div className="flex items-start gap-1">
                <span className="text-[10px] font-medium shrink-0 w-16" style={{ color: T.textMuted }}>Номер ВУ:</span>
                <span className="text-[10px]" style={{ color: T.text }}>{data.ocrData.driverLicense}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxSrc}
              alt="Документ"
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}