// /app/robots.ts
// ─────────────────────────────────────────────────────────────────────────────
// /robots.txt (task208, 2026-11-24). До этого файл не существовал — боты не
// знали о /sitemap.xml (теперь он есть, app/sitemap.ts). Правила ничего не
// ограничивают (как и было по умолчанию: весь сайт индексируем, noindex на
// уровне страниц — метаданными самих страниц), добавлена только ссылка на
// карту сайта и host-канонизация.
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";
import { resolveFranchizeSiteUrl } from "@/app/franchize/[slug]/metadata";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveFranchizeSiteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
