"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { registerVerifierOriginal, verifyDocAgainstStored } from "./actions";

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

export default function DocVerifierPage() {
  const searchParams = useSearchParams();
  const [integrationScope, setIntegrationScope] = useState(searchParams.get("integrationScope") || "core");
  const [documentKey, setDocumentKey] = useState(searchParams.get("documentKey") || "");
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
      setRegisterResult(result);
    });
  };

  const onVerify = (formData: FormData) => {
    formData.set("documentKey", documentKey);
    formData.set("integrationScope", integrationScope);
    startVerify(async () => {
      const result = await verifyDocAgainstStored(formData);
      setVerifyResult(result);
    });
  };

  const prefilledFromQuery = Boolean(searchParams.get("integrationScope") || searchParams.get("documentKey"));
  const verifierLink = `/doc-verifier?integrationScope=${encodeURIComponent(integrationScope)}&documentKey=${encodeURIComponent(documentKey)}`;

  const copyVerifierLink = async () => {
    if (!documentKey.trim()) return;
    await navigator.clipboard.writeText(verifierLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-20 pt-24">
      <h1 className="text-3xl font-semibold">Проверка DOCX</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Универсальная проверка целостности для любых интеграций: сохраняем оригинал, затем сверяем SHA-256.
      </p>
      {prefilledFromQuery && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
          Поля предзаполнены из карточки сделки — можешь сразу загружать DOCX и проверять.
        </div>
      )}

      <div className="mt-6 grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Область интеграции
          <input
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            placeholder="core / franchize / rentals"
            value={integrationScope}
            onChange={(event) => setIntegrationScope(event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Ключ документа
          <input
            className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm"
            placeholder="например: vip-bike-2026-03-24-001"
            value={documentKey}
            onChange={(event) => setDocumentKey(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={copyVerifierLink}
          disabled={!documentKey.trim()}
          className="rounded-lg border px-2.5 py-1.5 disabled:opacity-50"
        >
          {copied ? "Ссылка скопирована" : "Скопировать verify-ссылку"}
        </button>
        <span className="truncate text-muted-foreground">{verifierLink}</span>
      </div>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <form action={onRegister} className="rounded-2xl border p-4">
          <h2 className="text-lg font-medium">1) Регистрация оригинала</h2>
          <p className="mt-1 text-xs text-muted-foreground">Файл уходит в Storage, SHA-256 сохраняется в базе.</p>
          <input className="mt-3 w-full text-sm" type="file" name="file" accept=".docx" required />
          <input type="hidden" name="uploadedBy" value="doc-verifier-ui" />
          <button
            type="submit"
            disabled={isRegisterPending || documentKey.trim().length === 0}
            className="mt-4 w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isRegisterPending ? "Сохраняем..." : "Сохранить оригинал"}
          </button>
          {registerResult && (
            <div className="mt-3 rounded-xl border p-3 text-xs">
              {registerResult.success ? (
                <>
                  <p className="font-semibold text-emerald-500">Оригинал зарегистрирован</p>
                  <p className="mt-1 break-all">hash: {registerResult.uploadedHash}</p>
                  <p className="mt-1">time: {registerResult.verifiedAt}</p>
                </>
              ) : (
                <p className="font-semibold text-red-500">{registerResult.error}</p>
              )}
            </div>
          )}
        </form>

        <form action={onVerify} className="rounded-2xl border p-4">
          <h2 className="text-lg font-medium">2) Проверка документа</h2>
          <p className="mt-1 text-xs text-muted-foreground">Сверяем загруженный файл с хешем в БД и копией из Storage.</p>
          <input className="mt-3 w-full text-sm" type="file" name="file" accept=".docx" required />
          <button
            type="submit"
            disabled={isVerifyPending || documentKey.trim().length === 0}
            className="mt-4 w-full rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
          >
            {isVerifyPending ? "Проверяем..." : "Проверить документ"}
          </button>
          {verifyResult && (
            <div className="mt-3 rounded-xl border p-3 text-xs">
              {verifyResult.success ? (
                <>
                  <p className={`font-semibold ${verifyResult.matches && verifyResult.storageIntact ? "text-emerald-500" : "text-amber-500"}`}>
                    {verifyResult.matches && verifyResult.storageIntact ? "Проверка пройдена: хеши совпали" : "Проверка не пройдена: обнаружено изменение"}
                  </p>
                  <p className="mt-1 break-all">загруженный: {verifyResult.uploadedHash}</p>
                  <p className="mt-1 break-all">база/оригинал: {verifyResult.storedHash}</p>
                  <p className="mt-1 break-all">storage/оригинал: {verifyResult.storageHash}</p>
                  <p className="mt-1">время: {verifyResult.verifiedAt}</p>
                </>
              ) : (
                <p className="font-semibold text-red-500">{verifyResult.error}</p>
              )}
            </div>
          )}
        </form>
      </section>
    </main>
  );
}
