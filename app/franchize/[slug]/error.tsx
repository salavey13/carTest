"use client";

import Link from "next/link";
import { useEffect } from "react";
import { debugLogger } from "@/lib/debugLogger";

export default function FranchizeSlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    debugLogger.error("[franchize/[slug]/error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-red-400">crew shell error</p>
      <h1 className="mt-2 text-2xl font-semibold">Экипаж временно недоступен</h1>
      <p className="mt-3 text-sm text-muted-foreground">Не удалось загрузить страницу франшизы. Это может быть сетевой сбой или ошибка данных.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="rounded-xl border px-3 py-1.5 text-sm">
          Повторить
        </button>
        <Link href="/franchize" className="rounded-xl border px-3 py-1.5 text-sm">
          Все франшизы
        </Link>
      </div>
    </main>
  );
}
