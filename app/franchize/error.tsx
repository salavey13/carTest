"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { debugLogger } from "@/lib/debugLogger";
import { crewPaletteForSurface } from "./lib/theme";

export default function FranchizeSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
          {/* 2026-09-17: `reset` re-renders the crashed segment in place — one
              tap back into the flow, WITHOUT losing the URL (and therefore
              the order the renter was filling). Previously the only way out
              was «Вернуться в каталог», which drops the whole checkout. */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:brightness-110"
              style={{
                backgroundColor: DEFAULT_FRANCHIZE_THEME.palette.accentMain,
                color: "#16130A",
              }}
            >
              Попробовать ещё раз
            </button>
            <Link
              href="/franchize"
              className="inline-flex rounded-xl border px-4 py-2.5 text-sm"
              style={{
                borderColor: DEFAULT_FRANCHIZE_THEME.palette.accentMain,
                color: DEFAULT_FRANCHIZE_THEME.palette.accentMain,
              }}
            >
              Вернуться в каталог
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
