import Link from "next/link";
import { cookies } from "next/headers";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { getEarlyFranchizeThemeHint } from "../lib/early-theme-hints";
import { crewPaletteForSurface } from "../lib/theme";

const crewSkeletonLabels = ["Категории", "Доступность", "Контакты"] as const;

export default function FranchizeSlugLoading() {
  const earlyThemeSlug = cookies().get("franchize_slug_theme")?.value ?? "";
  const theme = getEarlyFranchizeThemeHint(earlyThemeSlug) ?? DEFAULT_FRANCHIZE_THEME;
  const surface = crewPaletteForSurface(theme);
  const accentBackground = surface.accentPill.backgroundColor;

  return (
    <main className="min-h-screen" style={surface.page} aria-busy="true">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-3 py-5 sm:px-4 sm:py-8">
        <div
          className="w-full overflow-hidden rounded-[2rem] border p-4 shadow-2xl sm:p-6"
          style={surface.subtleCard}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={surface.mutedText}>
            crew storefront
          </p>
          {/* FIX: Removed hardcoded "VIP BIKE" — now generic for all tenants */}
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Загрузка витрины...</h1>
          {/* FIX: Removed bike-specific "мотопарк" — now generic "каталог" */}
          <p className="mt-3 max-w-2xl text-sm leading-6" style={surface.mutedText} role="status">
            Подготавливаем каталог, цены, доступность и витрину экипажа.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            {/* FIX: Replaced bike skeleton (two wheels + frame) with generic content skeleton */}
            <div className="rounded-3xl border p-4" style={surface.card}>
              <div className="relative h-28 overflow-hidden rounded-2xl" style={{ backgroundColor: accentBackground }}>
                {/* Generic grid pattern instead of bike wheels/frame */}
                <div className="absolute inset-4 grid grid-cols-3 gap-2">
                  <div className="rounded-lg opacity-30" style={{ backgroundColor: theme.palette.accentMain }} />
                  <div className="rounded-lg opacity-20" style={{ backgroundColor: theme.palette.accentMain }} />
                  <div className="rounded-lg opacity-25" style={{ backgroundColor: theme.palette.accentMain }} />
                  <div className="col-span-2 rounded-lg opacity-15" style={{ backgroundColor: theme.palette.accentMain }} />
                  <div className="rounded-lg opacity-20" style={{ backgroundColor: theme.palette.accentMain }} />
                </div>
              </div>
              <div className="mt-4 h-3 w-2/3 animate-pulse rounded-full motion-reduce:animate-none" style={{ backgroundColor: accentBackground }} />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full opacity-70 motion-reduce:animate-none" style={{ backgroundColor: accentBackground }} />
            </div>
            <div className="grid gap-3">
              {crewSkeletonLabels.map((label) => (
                <div key={label} className="rounded-3xl border p-4" style={surface.card}>
                  <div className="h-2 w-12 animate-pulse rounded-full motion-reduce:animate-none" style={{ backgroundColor: accentBackground }} />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <Link href="/franchize" className="mt-6 inline-flex text-sm font-semibold" style={{ color: theme.palette.accentMain }}>
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}