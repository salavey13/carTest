export interface FranchizeSectionLink {
  label: string;
  href: string;
  active?: boolean;
}

const FRANCHIZE_INTENT_LINKS: Array<{ label: string; path: string }> = [
  { label: "Каталог", path: "" },
  { label: "Продажи", path: "/sales" },
  { label: "Аренды", path: "/rentals" },
  { label: "Карта", path: "/map-riders" },
  { label: "Сообщество", path: "/community" },
  { label: "Партнёрам", path: "/onboarding" },
  { label: "О нас", path: "/about" },
  { label: "Контакты", path: "/contacts" },
];

export function buildFranchizeIntentLinks(slug: string, activePath: string): FranchizeSectionLink[] {
  const basePath = `/franchize/${slug}`;

  return FRANCHIZE_INTENT_LINKS.map((link) => {
    const href = `${basePath}${link.path}`;
    return {
      label: link.label,
      href,
      active: activePath === href,
    };
  });
}
