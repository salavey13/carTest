"use client";

import { useState, useEffect, useCallback } from "react";
import { getRentalDocVerification, type DocVerificationData } from "@/app/franchize/server-actions/leads";

interface UseDocumentVerificationProps {
  rental: { rentalId: string | null; passportMainpagePhoto?: string | null; passportRegistrationPhoto?: string | null; driversLicenceFrontalPhoto?: string | null };
  slug: string;
  T: any;
}

export function useDocumentVerification({ rental, slug, T }: UseDocumentVerificationProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DocVerificationData | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const hasAnyPhoto = !!(rental.passportMainpagePhoto || rental.passportRegistrationPhoto || rental.driversLicenceFrontalPhoto);

  useEffect(() => {
    const rentalId = rental.rentalId;
    if (!rentalId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const result = await getRentalDocVerification(rentalId);
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

  const passportVerified = data?.checklist.passportVerified ?? false;
  const licenseVerified = data?.checklist.licenseVerified ?? false;

  const handleVerify = useCallback(async (docType: "passport" | "license") => {
    if (!rental.rentalId) return;
    setVerifying(docType);
    setVerifyMsg(null);
    try {
      const updates: Record<string, any> = {};
      if (docType === "passport") updates.passport_verified = true;
      else updates.license_verified = true;

      const resp = await fetch("/api/verify-rental-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalId: rental.rentalId, updates }),
      });
      const result = await resp.json();
      if (result.success) {
        setVerifyMsg({ ok: true, text: docType === "passport" ? "Паспорт верифицирован" : "Права верифицированы" });
        const refreshed = await getRentalDocVerification(rental.rentalId);
        if (refreshed.success && refreshed.data) setData(refreshed.data);
      } else {
        setVerifyMsg({ ok: false, text: result.error || "Ошибка верификации" });
      }
    } catch (err: any) {
      setVerifyMsg({ ok: false, text: err?.message || "Ошибка сети" });
    } finally {
      setVerifying(null);
    }
  }, [rental.rentalId]);

  return {
    loading,
    error,
    data,
    verifying,
    verifyMsg,
    lightboxSrc,
    setLightboxSrc,
    handleVerify,
    passportVerified,
    licenseVerified,
    hasAnyPhoto,
  };
}