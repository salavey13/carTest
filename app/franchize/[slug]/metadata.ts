import type { Metadata } from "next";
import { getFranchizeBySlug } from "../actions";

interface MetadataOptions {
  sectionTitle: string;
  sectionDescription: string;
  pathSuffix: string;
}

export async function buildFranchizeSectionMetadata(slug: string, options: MetadataOptions): Promise<Metadata> {
  try {
    const { crew } = await getFranchizeBySlug(slug);
    const resolvedSlug = crew.slug || slug;
    const title = `${options.sectionTitle} · ${crew.header.brandName} | oneSitePls`;
    const description = options.sectionDescription;
    const canonicalPath = `/franchize/${resolvedSlug}${options.pathSuffix}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        title,
        description,
        url: canonicalPath,
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    const fallbackTitle = `${options.sectionTitle} · Franchize ${slug} | oneSitePls`;
    const fallbackPath = `/franchize/${slug}${options.pathSuffix}`;
    return {
      title: fallbackTitle,
      description: options.sectionDescription,
      alternates: { canonical: fallbackPath },
      openGraph: {
        title: fallbackTitle,
        description: options.sectionDescription,
        url: fallbackPath,
        type: "website",
      },
      twitter: {
        card: "summary",
        title: fallbackTitle,
        description: options.sectionDescription,
      },
    };
  }
}
