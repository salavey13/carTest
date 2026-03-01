"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton } from "./FranchizeProfileButton";
import { toCategoryId } from "../lib/navigation";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
  groupLinks?: string[];
}

export function CrewHeader({ crew, activePath, groupLinks = [] }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogLinks, setCatalogLinks] = useState<string[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const railRef = useRef<HTMLDivElement | null>(null);

  const defaultGroupLinks = useMemo(
    () => Array.from(new Set([...crew.catalog.showcaseGroups.map((group) => group.label), ...crew.catalog.categories, ...groupLinks].filter(Boolean))),
    [crew.catalog.categories, crew.catalog.showcaseGroups, groupLinks],
  );

  const visibleRailLinks = useMemo(() => {
    if (pathname === mainCatalogPath && catalogLinks.length > 0) {
      return catalogLinks;
    }
    return defaultGroupLinks;
  }, [catalogLinks, defaultGroupLinks, mainCatalogPath, pathname]);

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 36);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pathname !== mainCatalogPath) {
      setActiveCategory(null);
      return;
    }

    const hydrateSections = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-category]"));
      const labels = sections
        .map((section) => section.getAttribute("data-category")?.trim() ?? "")
        .filter(Boolean);
      setCatalogLinks(Array.from(new Set(labels)));
      return sections;
    };

    let sections = hydrateSections();
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const mostVisible = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const category = mostVisible?.target.getAttribute("data-category");
        if (category) setActiveCategory(category);
      },
      { rootMargin: "-95px 0px -55% 0px", threshold: [0.2, 0.4, 0.65, 0.9] },
    );

    sections.forEach((section) => observer.observe(section));

    const mutationObserver = new MutationObserver(() => {
      observer.disconnect();
      sections = hydrateSections();
      sections.forEach((section) => observer.observe(section));
    });

    const catalogRoot = document.getElementById("catalog-sections");
    if (catalogRoot) mutationObserver.observe(catalogRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [mainCatalogPath, pathname]);

  useEffect(() => {
    if (pathname !== mainCatalogPath || typeof window === "undefined") return;

    const hash = window.location.hash?.replace("#", "");
    if (!hash) return;

    const section = document.getElementById(hash);
    if (!section) return;

    const yOffset = 136;
    const y = section.getBoundingClientRect().top + window.scrollY - yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [mainCatalogPath, pathname]);

  useEffect(() => {
    if (!activeCategory || !railRef.current) return;

    const activePill = railRef.current.querySelector<HTMLButtonElement>(`button[data-category-pill="${CSS.escape(activeCategory)}"]`);
    activePill?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  const scrollToCategory = (categoryLabel: string) => {
    const targetId = toCategoryId(categoryLabel);

    if (pathname !== mainCatalogPath) {
      router.push(`${mainCatalogPath}#${targetId}`);
      return;
    }

    const section = document.getElementById(targetId);
    if (!section) return;

    const yOffset = 136;
    const y = section.getBoundingClientRect().top + window.scrollY - yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setActiveCategory(categoryLabel);
  };

  return (
    <header
      className="sticky top-0 z-50 border-b px-4 pb-2 pt-[max(env(safe-area-inset-top),0.2rem)] backdrop-blur-2xl"
      style={{
        borderColor: crew.theme.palette.borderSoft,
        backgroundColor: `${crew.theme.palette.bgCard}F0`,
        color: crew.theme.palette.textPrimary,
      }}
    >
      <div className="mx-auto w-full max-w-4xl overflow-hidden">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr auto",
            alignItems: "center",
            gap: "0.75rem",
            maxHeight: isCompact ? 0 : 112,
            opacity: isCompact ? 0 : 1,
            paddingBottom: isCompact ? 0 : "0.5rem",
            transform: isCompact ? "scaleY(0.85) translateY(-8px)" : "scaleY(1) translateY(0)",
            transformOrigin: "top center",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.3s ease, max-height 0.32s ease",
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition"
            style={{
              backgroundColor: `${crew.theme.palette.bgBase}CC`,
              color: crew.theme.palette.textPrimary,
              pointerEvents: "auto",
            }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* HEADER LOGO — PURE SPA LINK (fixed) */}
          <Link
            href={mainCatalogPath}
            className="relative z-10 mx-auto flex flex-col items-center text-center cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto"
          >
            <div
              className="relative h-16 w-16 overflow-hidden rounded-full border shadow-lg"
              style={{
                borderColor: crew.theme.palette.accentMain,
                backgroundColor: crew.theme.palette.bgBase,
              }}
            >
              {crew.header.logoUrl ? (
                <Image
                  src={crew.header.logoUrl}
                  alt={`${crew.header.brandName} logo`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: crew.theme.palette.accentMain }}
                >
                  {crew.header.brandName}
                </div>
              )}
            </div>
          </Link>

          <FranchizeProfileButton
            bgColor={`${crew.theme.palette.bgBase}CC`}
            textColor={crew.theme.palette.textPrimary}
            borderColor={crew.theme.palette.borderSoft}
          />
        </div>
      </div>

      {visibleRailLinks.length > 0 ? (
        <div className="-mx-4 mt-1 border-t px-4 pt-2" style={{ borderColor: crew.theme.palette.borderSoft }}>
          <div
            ref={railRef}
            className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          >
            {visibleRailLinks.map((linkLabel) => {
              const isActive = activeCategory === linkLabel;
              return (
                <button
                  key={linkLabel}
                  type="button"
                  data-category-pill={linkLabel}
                  onClick={() => scrollToCategory(linkLabel)}
                  className="shrink-0 snap-start rounded-full bg-[var(--pill-bg)] px-4 py-2 text-xs font-medium tracking-wide text-[var(--pill-text)] transition-colors"
                  style={{
                    ["--pill-bg" as string]: isActive ? crew.theme.palette.accentMain : crew.theme.palette.bgCard,
                    ["--pill-text" as string]: isActive ? "#000000" : crew.theme.palette.textPrimary,
                  }}
                >
                  {linkLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}