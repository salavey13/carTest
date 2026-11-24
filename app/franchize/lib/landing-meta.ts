// /app/franchize/lib/landing-meta.ts
// ─────────────────────────────────────────────────────────────────────────────
// Метаданные верхнеуровневых лендингов экипажей (task208, 2026-11-24).
//
// Аудит task202–207 нашёл системный SEO-пробел: у всех пяти лендингов
// (/renta-car, /motoprokat1, /snowmobile-nn, /snegoprokat-nn, /renta-flat)
// metadata имел title/description/robots, но НЕ имел og:image (превью в
// Telegram/WhatsApp/VK — без картинки), canonical (дубли при хостах
// v0-car-test.vercel.app / preview / кастомных доменах), twitter-card и
// VK-хинтов. Витрина /franchize/[slug] всё это уже умела (app/franchize/
// [slug]/metadata.ts, buildMetadata) — механика переиспользуется (босс:
// «reuse our existing mechanics»): resolveFranchizeSiteUrl даёт канонический
// хост (NEXT_PUBLIC_SITE_URL || VERCEL_PROJECT_PRODUCTION_URL || default),
// VK-хинты vk:* — те же ключи, что у витрины.
//
// og:image — абсолютный URL фото (hero-обложка каталога в carpix Storage,
// «лицо витрины» из copy.heroItemId); фолбэка по лого нет намеренно: у всех
// пяти экипажей hero-фото реально залиты (task203/207).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import {
  resolveFranchizeSiteUrl,
  toAbsoluteFranchizeUrl,
} from "@/app/franchize/[slug]/metadata";

export interface CrewLandingMetaInput {
  /** Slug экипажа = первый сегмент пути лендинга (canonical /{slug}). */
  slug: string;
  /** siteName для OG (норматив: «{Бренд} · SLY13»). */
  siteName: string;
  /** <title> страницы (полный, с городом и суффиксом платформы). */
  title: string;
  /** meta description страницы. */
  description: string;
  /** Заголовок соц-карточки (короче title). */
  ogTitle: string;
  /** Описание соц-карточки (короче description). */
  ogDescription: string;
  /** Абсолютный URL обложки (hero-фото каталога, carpix Storage). */
  ogImage: string;
  /** alt обложки; по умолчанию «{siteName} — обложка». */
  ogImageAlt?: string;
}

/** Единые метаданные лендинга экипажа: canonical + OG + twitter + VK. */
export function crewLandingMetadata(input: CrewLandingMetaInput): Metadata {
  const siteUrl = resolveFranchizeSiteUrl();
  const canonicalPath = `/${input.slug}`;
  const absoluteImage = toAbsoluteFranchizeUrl(siteUrl, input.ogImage);
  const ogImageAlt = input.ogImageAlt || `${input.siteName} — обложка`;

  return {
    metadataBase: new URL(siteUrl),
    title: input.title,
    description: input.description,
    robots: { index: true, follow: true },
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "ru_RU",
      siteName: input.siteName,
      title: input.ogTitle,
      description: input.ogDescription,
      url: canonicalPath,
      images: [{ url: absoluteImage, alt: ogImageAlt }],
    },
    // Next отдаёт это ведро как twitter:*; Telegram/VK читают OG + хинты ниже.
    twitter: {
      card: "summary_large_image",
      title: input.ogTitle,
      description: input.ogDescription,
      images: [absoluteImage],
    },
    // VK-превью — те же хинты, что у витрины (buildVkMeta).
    other: {
      "vk:title": input.ogTitle,
      "vk:description": input.ogDescription,
      "vk:image": absoluteImage,
      "vk:url": canonicalPath,
    },
  };
}
