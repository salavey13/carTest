"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { debugLogger } from "@/lib/debugLogger";
import { crewPaletteForSurface } from "./lib/theme";

export default function FranchizeSegmentError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    debugLogger.error("[franchize/error]", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  const surface = crewPaletteForSurface(DEFAULT_FRANCHIZE_THEME);

  return (
    <main className="min-h-screen" style={surface.page}>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-3 py-5 sm:px-4 sm:py-8">
        <div className="w-full rounded-[2rem] border p-4 shadow-2xl sm:p-6" style={surface.subtleCard}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={surface.mutedText}>
            safe recovery
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Витрина временно не открылась</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={surface.mutedText}>
            Показываем только безопасное сообщение без сырых ответов сервера, ключей и внутренней диагностики.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-3xl border p-4" style={surface.card}>
                <div className="h-16 rounded-2xl" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
                <div className="mt-4 h-3 w-2/3 rounded-full" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
              </div>
            ))}
          </div>
          {error.digest ? <p className="mt-4 text-[11px] opacity-50" style={surface.mutedText}>debug digest: {error.digest}</p> : null}
          <Link href="/franchize" className="mt-6 inline-flex text-sm font-semibold" style={{ color: DEFAULT_FRANCHIZE_THEME.palette.accentMain }}>
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
