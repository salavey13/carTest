import Link from "next/link";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { crewPaletteForSurface } from "./lib/theme";

// FIX: Replaced bike-specific "Мотопарк" with generic "Каталог"
const catalogSkeletonCards = ["Витрины", "Экипажи", "Каталог"] as const;

export default function FranchizeLoading() {
  const surface = crewPaletteForSurface(DEFAULT_FRANCHIZE_THEME);
  const accentBackground = surface.accentPill.backgroundColor;

  return (
    <main className="min-h-screen" style={surface.page} aria-busy="true">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-3 py-5 sm:px-4 sm:py-8">
        <div
          className="w-full overflow-hidden rounded-[2rem] border p-4 shadow-2xl sm:p-6"
          style={surface.subtleCard}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={surface.mutedText}>
            franchize catalog
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Загрузка каталога...</h1>
          {/* FIX: Removed bike-specific "мотопарк" — now generic "каталог" */}
          <p className="mt-3 max-w-2xl text-sm leading-6" style={surface.mutedText} role="status">
            Готовим список экипажей, витрины и быстрый переход в каталог.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {catalogSkeletonCards.map((label) => (
              <div key={label} className="rounded-3xl border p-4" style={surface.card}>
                <div className="h-24 animate-pulse rounded-2xl motion-reduce:animate-none" style={{ backgroundColor: accentBackground }} />
                <div className="mt-4 h-3 w-2/3 rounded-full" style={{ backgroundColor: accentBackground }} />
                <div className="mt-2 h-3 w-1/2 rounded-full opacity-70" style={{ backgroundColor: accentBackground }} />
                <p className="mt-3 text-xs font-semibold" style={surface.mutedText}>{label}</p>
              </div>
            ))}
          </div>
          <Link href="/franchize" className="mt-6 inline-flex text-sm font-semibold" style={{ color: DEFAULT_FRANCHIZE_THEME.palette.accentMain }}>
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}