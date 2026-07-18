"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_FRANCHIZE_THEME } from "@/lib/franchize-config";
import { debugLogger } from "@/lib/debugLogger";
import { crewPaletteForSurface } from "../lib/theme";

const slugFromPath = (pathname: string | null) => {
  const parts = (pathname ?? "").split("/").filter(Boolean);
  const franchizeIndex = parts.indexOf("franchize");
  return franchizeIndex >= 0 ? parts[franchizeIndex + 1] : undefined;
};

export default function FranchizeSlugError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const pathname = usePathname();
  const slug = slugFromPath(pathname);

  useEffect(() => {
    debugLogger.error("[franchize/[slug]/error]", {
      name: error.name,
      digest: error.digest,
    });
  }, [error]);

  const surface = crewPaletteForSurface(DEFAULT_FRANCHIZE_THEME);
  const catalogHref = slug ? `/franchize/${slug}` : "/franchize";

  return (
    <main className="min-h-screen" style={surface.page}>
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-3 py-5 sm:px-4 sm:py-8">
        <div className="w-full rounded-[2rem] border p-4 shadow-2xl sm:p-6" style={surface.subtleCard}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={surface.mutedText}>
            crew recovery
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Экипаж временно недоступен</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={surface.mutedText}>
            Клиент видит спокойный fallback без секретов, stack trace и сырых ответов базы.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border p-4" style={surface.card}>
              <div className="h-28 rounded-2xl" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
              <div className="mt-4 h-3 w-2/3 rounded-full" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
              <div className="mt-2 h-3 w-1/2 rounded-full opacity-70" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
            </div>
            <div className="grid gap-3">
              {[
                { label: "Каталог", href: catalogHref },
                { label: "Контакты", href: `${catalogHref}/contacts` },
                { label: "Поддержка", href: "https://t.me/SALAVEY13" },
              ].map((link) => (
                <Link key={link.label} href={link.href} className="rounded-3xl border p-4 block" style={surface.card}>
                  <div className="h-2 w-12 rounded-full" style={{ backgroundColor: surface.accentPill.backgroundColor }} />
                  <p className="mt-3 text-sm font-semibold">{link.label}</p>
                </Link>
              ))}
            </div>
          </div>
          {error.digest ? <p className="mt-4 text-[11px] opacity-50" style={surface.mutedText}>debug digest: {error.digest}</p> : null}
          <Link href={catalogHref} className="mt-6 inline-flex text-sm font-semibold" style={{ color: DEFAULT_FRANCHIZE_THEME.palette.accentMain }}>
            Вернуться в каталог
          </Link>
        </div>
      </section>
    </main>
  );
}
