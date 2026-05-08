import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getFranchizeBySlug } from "../actions";
import { resolveFranchizeSiteUrl, toAbsoluteFranchizeUrl } from "./metadata";

interface FranchizeSlugLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Omit<FranchizeSlugLayoutProps, "children">): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = resolveFranchizeSiteUrl();

  try {
    const { crew, items } = await getFranchizeBySlug(slug);
    const title = `${crew.header.brandName} | oneSitePls`;
    const description = crew.header.subtitle?.trim() || `Каталог, аренда и покупка техники экипажа ${crew.header.brandName}.`;
    const image = toAbsoluteFranchizeUrl(siteUrl, crew.header.logoUrl || items.find((item) => item.imageUrl)?.imageUrl || "/icon0.svg");
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

// Chrome policy for /franchize/[slug]: every public/customer/operator page should
// server-load getFranchizeBySlug(slug), render CrewHeader, and use FranchizePageShell
// for first-paint theme, spacing, and navigation continuity. Any route that opts out
// must leave a local comment explaining why shared franchize chrome is intentionally skipped.
export default function FranchizeSlugLayout({ children }: FranchizeSlugLayoutProps) {
  return children;
}
