"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

type UnknownRecord = Record<string, unknown>;

export interface FranchizeTheme {
  mode: string;
  palette: {
    bgBase: string;
    bgCard: string;
    accentMain: string;
    accentMainHover: string;
    textPrimary: string;
    textSecondary: string;
    borderSoft: string;
  };
}

export interface FranchizeHeaderVM {
  brandName: string;
  tagline: string;
  logoUrl: string;
  menuLinks: Array<{ label: string; href: string }>;
}

export interface CatalogItemVM {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  pricePerDay: number;
  category: string;
}

export interface FranchizeCrewVM {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  hqLocation: string;
  isFound: boolean;
  theme: FranchizeTheme;
  header: FranchizeHeaderVM;
  contacts: {
    phone: string;
    email: string;
    address: string;
  };
  catalog: {
    categories: string[];
  };
}

export interface FranchizeBySlugResult {
  crew: FranchizeCrewVM;
  items: CatalogItemVM[];
}

const defaultTheme: FranchizeTheme = {
  mode: "pepperolli_dark",
  palette: {
    bgBase: "#0B0C10",
    bgCard: "#111217",
    accentMain: "#D99A00",
    accentMainHover: "#E2A812",
    textPrimary: "#F2F2F3",
    textSecondary: "#A7ABB4",
    borderSoft: "#24262E",
  },
};

function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = (current as UnknownRecord)[key];
  }
  return (current as T) ?? fallback;
}

const fallbackMenuLinks = (slug: string) => [
  { label: "Каталог", href: `/franchize/${slug}` },
  { label: "О нас", href: `/franchize/${slug}/about` },
  { label: "Контакты", href: `/franchize/${slug}/contacts` },
  { label: "Корзина", href: `/franchize/${slug}/cart` },
];

const withSlug = (href: string, slug: string) => {
  if (!href) {
    return href;
  }

  if (href.includes("{slug}")) {
    return href.replaceAll("{slug}", slug);
  }

  switch (href) {
    case "/franchize/about":
      return `/franchize/${slug}/about`;
    case "/franchize/contacts":
      return `/franchize/${slug}/contacts`;
    case "/franchize/cart":
      return `/franchize/${slug}/cart`;
    default:
      return href;
  }
};

const emptyCrew = (slug: string): FranchizeCrewVM => ({
  id: "",
  slug,
  name: "Crew not found",
  description: "No franchise crew found for this slug yet.",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: defaultTheme,
  header: {
    brandName: "Franchize",
    tagline: "Hydration pending",
    logoUrl: "",
    menuLinks: fallbackMenuLinks(slug),
  },
  contacts: {
    phone: "",
    email: "",
    address: "",
  },
  catalog: {
    categories: [],
  },
});

export async function getFranchizeBySlug(slug: string): Promise<FranchizeBySlugResult> {
  const safeSlug = slug?.trim();
  if (!safeSlug) {
    return { crew: emptyCrew("unknown"), items: [] };
  }

  try {
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("*")
      .eq("slug", safeSlug)
      .maybeSingle();

    if (crewError || !crew) {
      if (crewError) {
        logger.warn("[franchize] failed to load crew by slug", { safeSlug, crewError: crewError.message });
      }
      return { crew: emptyCrew(safeSlug), items: [] };
    }

    const { data: cars, error: carsError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, image_url, daily_price, type, specs")
      .eq("crew_id", crew.id)
      .ilike("type", "bike");

    if (carsError) {
      logger.warn("[franchize] failed to load crew cars", { safeSlug, carsError: carsError.message });
    }

    const metadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
    const franchize = (metadata.franchize ?? metadata) as UnknownRecord;

    const themePalette = readPath(franchize, ["theme", "palette"], defaultTheme.palette);
    const menuLinks = readPath(franchize, ["header", "menuLinks"], fallbackMenuLinks(safeSlug)).map((link) => ({
      ...link,
      href: withSlug(link.href, crew.slug ?? safeSlug),
    }));

    const hydratedCrew: FranchizeCrewVM = {
      id: crew.id,
      slug: crew.slug ?? safeSlug,
      name: crew.name ?? "Unnamed crew",
      description: crew.description ?? "",
      logoUrl: crew.logo_url ?? "",
      hqLocation: crew.hq_location ?? "",
      isFound: true,
      theme: {
        mode: readPath(franchize, ["theme", "mode"], defaultTheme.mode),
        palette: {
          bgBase: readPath(themePalette, ["bgBase"], defaultTheme.palette.bgBase),
          bgCard: readPath(themePalette, ["bgCard"], defaultTheme.palette.bgCard),
          accentMain: readPath(themePalette, ["accentMain"], defaultTheme.palette.accentMain),
          accentMainHover: readPath(themePalette, ["accentMainHover"], defaultTheme.palette.accentMainHover),
          textPrimary: readPath(themePalette, ["textPrimary"], defaultTheme.palette.textPrimary),
          textSecondary: readPath(themePalette, ["textSecondary"], defaultTheme.palette.textSecondary),
          borderSoft: readPath(themePalette, ["borderSoft"], defaultTheme.palette.borderSoft),
        },
      },
      header: {
        brandName: readPath(franchize, ["branding", "name"], crew.name ?? "Franchize"),
        tagline: readPath(franchize, ["branding", "tagline"], "Ride the vibe"),
        logoUrl: readPath(franchize, ["branding", "logoUrl"], crew.logo_url ?? ""),
        menuLinks,
      },
      contacts: {
        phone: readPath(franchize, ["contacts", "phone"], readPath(franchize, ["footer", "phone"], "")),
        email: readPath(franchize, ["contacts", "email"], readPath(franchize, ["footer", "email"], "")),
        address: readPath(
          franchize,
          ["contacts", "address"],
          readPath(franchize, ["footer", "address"], crew.hq_location ?? ""),
        ),
      },
      catalog: {
        categories: readPath(franchize, ["catalog", "groupOrder"], []),
      },
    };

    const items: CatalogItemVM[] = (cars ?? []).map((car) => {
      const specs = (car.specs ?? {}) as UnknownRecord;
      const fallbackCategory = typeof specs.type === "string" ? specs.type : "Unsorted";
      return {
        id: car.id,
        title: `${car.make} ${car.model}`.trim(),
        subtitle: (typeof specs.subtitle === "string" ? specs.subtitle : "Ready to ride") as string,
        description: car.description ?? "",
        imageUrl: car.image_url ?? "",
        pricePerDay: car.daily_price ?? 0,
        category: car.type || fallbackCategory,
      };
    });

    return {
      crew: {
        ...hydratedCrew,
        catalog: {
          categories:
            hydratedCrew.catalog.categories.length > 0
              ? hydratedCrew.catalog.categories
              : [...new Set(items.map((item) => item.category).filter(Boolean))],
        },
      },
      items,
    };
  } catch (error) {
    logger.error("[franchize] unexpected getFranchizeBySlug failure", error);
    return { crew: emptyCrew(safeSlug), items: [] };
  }
}
