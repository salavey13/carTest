import type { Metadata } from "next";
import { getFranchizeBySlug, type CatalogItemVM, type FranchizeCrewVM } from "../actions";

const DEFAULT_SITE_URL = "https://v0-car-test.vercel.app";
const CREW_LOGO_FALLBACK = "/icon0.svg";

type FranchizeMetadataContext = {
  crew: FranchizeCrewVM;
  items: CatalogItemVM[];
  slug: string;
  resolvedSlug: string;
};

type MetadataTextOption = string | ((context: FranchizeMetadataContext) => string | undefined | null);
type SocialCard = "summary" | "summary_large_image";

interface MetadataOptions {
  sectionTitle: MetadataTextOption;
  sectionDescription: MetadataTextOption;
  pathSuffix: string;
  ogTitle?: MetadataTextOption;
  ogDescription?: MetadataTextOption;
  image?: string | ((context: FranchizeMetadataContext) => string | undefined | null);
  imageAlt?: string | ((context: FranchizeMetadataContext) => string | undefined | null);
  socialCard?: SocialCard;
  twitterCard?: SocialCard;
}

export function resolveFranchizeSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || DEFAULT_SITE_URL;
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

export function toAbsoluteFranchizeUrl(siteUrl: string, maybeRelativeUrl: string) {
  if (!maybeRelativeUrl) return new URL(CREW_LOGO_FALLBACK, siteUrl).toString();
  if (maybeRelativeUrl.startsWith("http://") || maybeRelativeUrl.startsWith("https://")) return maybeRelativeUrl;
  return new URL(maybeRelativeUrl, siteUrl).toString();
}

function defaultCrewImage({ crew }: FranchizeMetadataContext) {
  return crew.header.logoUrl || crew.logoUrl || CREW_LOGO_FALLBACK;
}

function resolveTextOption(option: MetadataTextOption, context: FranchizeMetadataContext) {
  return (typeof option === "function" ? option(context) : option) || "Franchize";
}

function resolveOptionalTextOption(option: MetadataTextOption | undefined, context: FranchizeMetadataContext) {
  if (!option) return undefined;
  return typeof option === "function" ? option(context) || undefined : option;
}

function fallbackTextOption(option: MetadataTextOption, fallback: string) {
  return typeof option === "string" ? option : fallback;
}

function buildVkMeta({
  title,
  description,
  image,
  url,
}: {
  title: string;
  description: string;
  image: string;
  url: string;
}) {
  return {
    "vk:title": title,
    "vk:description": description,
    "vk:image": image,
    "vk:url": url,
  };
}

function resolveRouteImage(context: FranchizeMetadataContext, options: MetadataOptions) {
  if (typeof options.image === "function") return options.image(context) || defaultCrewImage(context);
  return options.image || defaultCrewImage(context);
}

function resolveRouteImageAlt(context: FranchizeMetadataContext, options: MetadataOptions) {
  if (typeof options.imageAlt === "function") return options.imageAlt(context) || `${context.crew.header.brandName} preview`;
  return options.imageAlt || `${context.crew.header.brandName} preview`;
}

function buildMetadata({
  title,
  description,
  canonicalPath,
  ogTitle,
  ogDescription,
  image,
  imageAlt,
  socialCard = "summary_large_image",
}: {
  title: string;
  description: string;
  canonicalPath: string;
  ogTitle?: string;
  ogDescription?: string;
  image: string;
  imageAlt: string;
  socialCard?: SocialCard;
}): Metadata {
  const siteUrl = resolveFranchizeSiteUrl();
  const absoluteImage = toAbsoluteFranchizeUrl(siteUrl, image);
  const resolvedOgTitle = ogTitle || title;
  const resolvedOgDescription = ogDescription || description;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      siteName: "oneSitePls",
      title: resolvedOgTitle,
      description: resolvedOgDescription,
      url: canonicalPath,
      type: "website",
      locale: "ru_RU",
      images: [{ url: absoluteImage, alt: imageAlt }],
    },
    // Next.js exposes this bucket as `twitter`; Telegram/VK still receive OpenGraph plus VK hints below.
    twitter: {
      card: socialCard,
      title: resolvedOgTitle,
      description: resolvedOgDescription,
      images: [absoluteImage],
    },
    other: buildVkMeta({
      title: resolvedOgTitle,
      description: resolvedOgDescription,
      image: absoluteImage,
      url: canonicalPath,
    }),
  };
}

export async function buildFranchizeSectionMetadata(slug: string, options: MetadataOptions): Promise<Metadata> {
  try {
    const { crew, items } = await getFranchizeBySlug(slug);
    const resolvedSlug = crew.slug || slug;
    const context = { crew, items, slug, resolvedSlug };
    const sectionTitle = resolveTextOption(options.sectionTitle, context);
    const description = resolveTextOption(options.sectionDescription, context);
    const title = `${sectionTitle} · ${crew.header.brandName} | oneSitePls`;
    const canonicalPath = `/franchize/${resolvedSlug}${options.pathSuffix}`;

    return buildMetadata({
      title,
      description,
      canonicalPath,
      ogTitle: resolveOptionalTextOption(options.ogTitle, context) || title,
      ogDescription: resolveOptionalTextOption(options.ogDescription, context) || description,
      image: resolveRouteImage(context, options),
      imageAlt: resolveRouteImageAlt(context, options),
      socialCard: options.socialCard || options.twitterCard,
    });
  } catch {
    const fallbackTitle = `${fallbackTextOption(options.sectionTitle, "Franchize")} · Franchize ${slug} | oneSitePls`;
    const fallbackPath = `/franchize/${slug}${options.pathSuffix}`;
    return buildMetadata({
      title: fallbackTitle,
      description: fallbackTextOption(options.sectionDescription, `Витрина franchize ${slug}.`),
      canonicalPath: fallbackPath,
      ogTitle: fallbackTextOption(options.ogTitle || options.sectionTitle, fallbackTitle),
      ogDescription: fallbackTextOption(options.ogDescription || options.sectionDescription, `Витрина franchize ${slug}.`),
      image: CREW_LOGO_FALLBACK,
      imageAlt: `Franchize ${slug} preview`,
      socialCard: options.socialCard || options.twitterCard || "summary",
    });
  }
}

export function findCatalogItemImage(items: CatalogItemVM[], itemId?: string) {
  const item = itemId ? items.find((candidate) => candidate.id === itemId) : undefined;
  return item?.imageUrl || item?.mediaUrls?.find(Boolean) || undefined;
}
