import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getFranchizeBySlug } from "../actions";

interface FranchizeSlugLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

const DEFAULT_SITE_URL = "https://v0-car-test.vercel.app";

function resolveSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || DEFAULT_SITE_URL;
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}

function toAbsoluteUrl(siteUrl: string, maybeRelativeUrl: string) {
  if (!maybeRelativeUrl) return `${siteUrl}/icon0.svg`;
  if (maybeRelativeUrl.startsWith("http://") || maybeRelativeUrl.startsWith("https://")) return maybeRelativeUrl;
  return new URL(maybeRelativeUrl, siteUrl).toString();
}

export async function generateMetadata({ params }: Omit<FranchizeSlugLayoutProps, "children">): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = resolveSiteUrl();

  try {
    const { crew, items } = await getFranchizeBySlug(slug);
    const title = `${crew.header.brandName} | oneSitePls`;
    const description = crew.header.subtitle?.trim() || `Каталог, аренда и покупка техники экипажа ${crew.header.brandName}.`;
    const image = toAbsoluteUrl(siteUrl, crew.header.logoUrl || items.find((item) => item.imageUrl)?.imageUrl || "/icon0.svg");
    const path = `/franchize/${crew.slug || slug}`;
    const keywords = [
      crew.header.brandName,
      "franchize",
      "электробайки",
      "аренда байков",
      "покупка байков",
      ...Array.from(new Set(items.map((item) => item.category).filter(Boolean))),
    ];

    return {
      metadataBase: new URL(siteUrl),
      title,
      description,
      keywords,
      robots: {
        index: true,
        follow: true,
      },
      alternates: { canonical: path },
      openGraph: {
        siteName: "oneSitePls",
        title,
        description,
        url: path,
        type: "website",
        locale: "ru_RU",
        images: [{ url: image, alt: `${crew.header.brandName} preview` }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
    };
  } catch {
    const fallbackTitle = `Franchize ${slug} | oneSitePls`;
    const fallbackDescription = `Витрина franchize ${slug}: каталог, аренда и покупка техники.`;
    const fallbackPath = `/franchize/${slug}`;
    return {
      metadataBase: new URL(siteUrl),
      title: fallbackTitle,
      description: fallbackDescription,
      robots: {
        index: true,
        follow: true,
      },
      alternates: { canonical: fallbackPath },
      openGraph: {
        siteName: "oneSitePls",
        title: fallbackTitle,
        description: fallbackDescription,
        url: fallbackPath,
        type: "website",
        locale: "ru_RU",
      },
      twitter: {
        card: "summary",
        title: fallbackTitle,
        description: fallbackDescription,
      },
    };
  }
}

export default function FranchizeSlugLayout({ children }: FranchizeSlugLayoutProps) {
  return children;
}
