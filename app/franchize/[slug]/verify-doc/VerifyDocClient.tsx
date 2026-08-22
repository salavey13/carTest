"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { registerVerifierOriginal, verifyDocAgainstStored } from "../../../doc-verifier/actions";

type VerificationState = {
  success: boolean;
  error?: string;
  documentKey?: string;
  uploadedHash?: string;
  storedHash?: string;
  storageHash?: string;
  verifiedAt?: string;
  matches?: boolean;
  storageIntact?: boolean;
} | null;

interface VerifyDocClientProps {
  initialIntegrationScope: string;
  initialDocumentKey: string;
}

export function VerifyDocClient({ initialIntegrationScope, initialDocumentKey }: VerifyDocClientProps) {
  const [integrationScope, setIntegrationScope] = useState(initialIntegrationScope);
  const [documentKey, setDocumentKey] = useState(initialDocumentKey);
  const [registerResult, setRegisterResult] = useState<VerificationState>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationState>(null);
  const [copied, setCopied] = useState(false);
  const [isRegisterPending, startRegister] = useTransition();
  const [isVerifyPending, startVerify] = useTransition();

  const onRegister = (formData: FormData) => {
    formData.set("documentKey", documentKey);
    formData.set("integrationScope", integrationScope);
    startRegister(async () => {
      const result = await registerVerifierOriginal(formData);
      setRegisterResult(result as VerificationState);
    });
  };

  const onVerify = (formData: FormData) => {
    formData.set("documentKey", documentKey);
    formData.set("integrationScope", integrationScope);
    startVerify(async () => {
      const result = await verifyDocAgainstStored(formData);
      setVerifyResult(result as VerificationState);
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accent = "var(--franchize-accent-main, #f59e0b)";
  const textPrimary = "var(--franchize-text-primary, #fff)";
  const textSecondary = "var(--franchize-text-secondary, #aaa)";
  const bgCard = "var(--franchize-bg-card, #1a1a1a)";
  const borderSoft = "var(--franchize-border-soft, #333)";
  const inputBg = "var(--franchize-bg-base, #0a0a0a)";

  return (
    <div className="mt-6 space-y-6">
      {/* Scope + Key inputs */}
      <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: borderSoft, backgroundColor: bgCard }}>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: textSecondary }}>
            Integration Scope
          </span>
          <input
            type="text"
            value={integrationScope}
            onChange={(e) => setIntegrationScope(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: borderSoft, backgroundColor: inputBg, color: textPrimary }}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: textSecondary }}>
            Document Key
          </span>
          <input
            type="text"
            value={documentKey}
            onChange={(e) => setDocumentKey(e.target.value)}
            placeholder="rental-vip-bike-abc-123"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: borderSoft, backgroundColor: inputBg, color: textPrimary }}
          />
        </label>
      </div>

      {/* Register section */}
      <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: borderSoft, backgroundColor: bgCard }}>
        <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
          1. Зарегистрировать оригинал
        </h3>
        <p className="text-xs" style={{ color: textSecondary }}>
          Загрузите исходный документ для регистрации его хеша в системе.
        </p>
        <form action={onRegister} className="space-y-2">
          <input
            type="file"
            name="file"
            accept=".docx,.pdf,.png,.jpg,.jpeg"
            required
            className="w-full text-sm"
            style={{ color: textPrimary }}
          />
          <button
            type="submit"
            disabled={isRegisterPending || !documentKey}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50"
            style={{ backgroundColor: accent, color: "#16130A" }}
          >
            {isRegisterPending ? "Регистрация..." : "Зарегистрировать"}
          </button>
        </form>
        {registerResult && (
          <div className="mt-2 rounded-lg border p-3 text-xs" style={{ borderColor: borderSoft }}>
            {registerResult.success ? (
              <div className="space-y-1">
                <p style={{ color: "#22c55e" }}>✓ Документ зарегистрирован</p>
                <p style={{ color: textSecondary }}>SHA-256: {registerResult.uploadedHash}</p>
                <button
                  onClick={() => copyToClipboard(registerResult.uploadedHash || "")}
                  className="text-xs underline"
                  style={{ color: accent }}
                >
                  {copied ? "Скопировано!" : "Копировать хеш"}
                </button>
              </div>
            ) : (
              <p style={{ color: "#ef4444" }}>✗ {registerResult.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Verify section */}
      <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: borderSoft, backgroundColor: bgCard }}>
        <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
          2. Проверить документ
        </h3>
        <p className="text-xs" style={{ color: textSecondary }}>
          Загрузите копию документа для проверки совпадения хеша с оригиналом.
        </p>
        <form action={onVerify} className="space-y-2">
          <input
            type="file"
            name="file"
            accept=".docx,.pdf,.png,.jpg,.jpeg"
            required
            className="w-full text-sm"
            style={{ color: textPrimary }}
          />
          <button
            type="submit"
            disabled={isVerifyPending || !documentKey}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50"
            style={{ backgroundColor: accent, color: "#16130A" }}
          >
            {isVerifyPending ? "Проверка..." : "Проверить"}
          </button>
        </form>
        {verifyResult && (
          <div className="mt-2 rounded-lg border p-3 text-xs" style={{ borderColor: borderSoft }}>
            {verifyResult.success ? (
              <div className="space-y-1">
                <p style={{ color: verifyResult.matches ? "#22c55e" : "#ef4444" }}>
                  {verifyResult.matches ? "✓ Документ подлинный — хеши совпадают" : "✗ Хеши не совпадают — документ изменён"}
                </p>
                <p style={{ color: textSecondary }}>Загруженный: {verifyResult.uploadedHash}</p>
                <p style={{ color: textSecondary }}>Сохранённый: {verifyResult.storedHash}</p>
                {verifyResult.verifiedAt && (
                  <p style={{ color: textSecondary }}>Проверено: {new Date(verifyResult.verifiedAt).toLocaleString("ru-RU")}</p>
                )}
              </div>
            ) : (
              <p style={{ color: "#ef4444" }}>✗ {verifyResult.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
