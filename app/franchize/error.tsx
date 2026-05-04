"use client";

import Link from "next/link";
import { useEffect } from "react";
import { debugLogger } from "@/lib/debugLogger";

export default function FranchizeSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    debugLogger.error("[franchize/error]", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col justify-center px-4 py-10">
      <p className="text-xs uppercase tracking-[0.2em] text-red-400">franchize route error</p>
      <h1 className="mt-2 text-2xl font-semibold">Ошибка в разделе franchize</h1>
      <p className="mt-3 text-sm text-muted-foreground">Мы уже получили сигнал о проблеме. Попробуйте перезагрузить экран или открыть раздел позже.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="rounded-xl border px-3 py-1.5 text-sm">
          Повторить
        </button>
        <Link href="/franchize" className="rounded-xl border px-3 py-1.5 text-sm">
          К франшизам
        </Link>
      </div>
    </main>
  );
}
