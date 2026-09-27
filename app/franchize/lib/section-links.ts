export interface FranchizeSectionLink {
  label: string;
  href: string;
  active?: boolean;
}

const FRANCHIZE_INTENT_LINKS: Array<{ label: string; path: string; onlyForSlugs?: string[] }> = [
  { label: "Каталог", path: "" },
  { label: "Продажи", path: "/sales" },
  { label: "Аренды", path: "/rentals" },
  // iter28: «Мотопарк» — стена мото (история каждого мото для всей команды)
  { label: "Мотопарк", path: "/bikes" },
  // 2026-09-27: «Зимнее хранение» — стена для ВЛАДЕЛЬЦЕВ (байки на сезоне,
  // не для аренды). Config-driven: call sites pass { storageEnabled } from
  // crew.storage; the legacy vip-bike fallback keeps old callers working.
  { label: "Хранение", path: "/storage" },
  { label: "Карта", path: "/map-riders" },
  { label: "Сообщество", path: "/community" },
  { label: "Партнёрам", path: "/onboarding" },
  { label: "О нас", path: "/about" },
  { label: "Контакты", path: "/contacts" },
];

export interface FranchizeIntentLinkOptions {
  /** crew.storage?.enabled — undefined falls back to the legacy vip-bike rule. */
  storageEnabled?: boolean;
}

export function buildFranchizeIntentLinks(
  slug: string,
  activePath: string,
  options?: FranchizeIntentLinkOptions,
): FranchizeSectionLink[] {
  const basePath = `/franchize/${slug}`;

  const storageEnabled = options?.storageEnabled ?? slug === "vip-bike";

  return FRANCHIZE_INTENT_LINKS.filter((link) => {
    if (link.label === "Хранение") return storageEnabled;
    return !link.onlyForSlugs || link.onlyForSlugs.includes(slug);
  }).map((link) => {
    const href = `${basePath}${link.path}`;
    return {
      label: link.label,
      href,
      active: activePath === href,
    };
  });
}
