// /app/sitemap.ts
// ─────────────────────────────────────────────────────────────────────────────
// /sitemap.xml (task208, 2026-11-24). До этого sitemap в приложении не
// существовал вовсе — боты блуждали по сотне служебных маршрутов платформы
// (арбитражи, тесты, админки) без карты. В карту — только публичные
// лид-генерирующие страницы: главная, лендинг платформы /salavey13, эталон
// /moto-selection, 5 экипажных лендингов (task202–207) и флагманская витрина
// /franchize/vip-bike (проверен 200 на проде 2026-11-24).
//
// Хост — resolveFranchizeSiteUrl() (та же механика, что у canonical витрин):
// NEXT_PUBLIC_SITE_URL || VERCEL_PROJECT_PRODUCTION_URL || default.
// Витринные подстраницы экипажей (about/storage/contacts/…) уже имеют свои
// canonical — сюда их не дублируем, карта отвечает за верхний уровень.
//
// task211 (2026-11-25): досы́пан задел task210 — /georg-electro, /mototehnn,// /leorus получили собственные топ-лендинги с canonical+og (e4ece20), но в
// карту не попали: боты не знали о трёх живых страницах. Плюс сюда же —
// /franchize/discovery (карта сети, data-driven, 25 экипажей) и /sly13
// (редирект на /salavey13 — в карте НЕ нужен, canonical укажет канон).
// ─────────────────────────────────────────────────────────────────────────────

import type { MetadataRoute } from "next";
import { resolveFranchizeSiteUrl } from "@/app/franchize/[slug]/metadata";

const LANDING_PAGES: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: "/salavey13", priority: 0.9 },
  { path: "/renta-car", priority: 0.9 },
  { path: "/motoprokat1", priority: 0.9 },
  { path: "/snowmobile-nn", priority: 0.9 },
  { path: "/snegoprokat-nn", priority: 0.9 },
  { path: "/moto-selection", priority: 0.8 },
  { path: "/franchize/vip-bike", priority: 0.8 },
  { path: "/renta-flat", priority: 0.7 },
  { path: "/georg-electro", priority: 0.7 },
  { path: "/mototehnn", priority: 0.7 },
  { path: "/leorus", priority: 0.7 },
  { path: "/franchize/discovery", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveFranchizeSiteUrl();
  const lastModified = new Date();
  return LANDING_PAGES.map((page) => ({
    url: `${siteUrl}${page.path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: page.priority,
  }));
}
