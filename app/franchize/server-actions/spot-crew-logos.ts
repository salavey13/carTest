"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Круглые картинки для crew-точек карты («instead of simple dots show real
// icons with round pictures if available» — map-riders, 2026-09-22).
//
// Мототочки НН — dummy-экипажи (crews.slug = spot.slug, миграция
// 20260921000000). Логотипов у них пока нет (seed пишет NULL), но когда
// владелец точки задаст logo_url — маркер на карте автоматически станет
// круглой аватаркой вместо иконки-бейджа. Фолбэк — kind-иконка точки.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from "@/lib/supabase-server";
import { NN_MOTO_SPOTS } from "@/lib/map-riders-spots";

export type SpotCrewLogoMap = Record<string, string | null>;

/** logo_url по slug для всех мототочек; отсутствие строки/логотипа → null. */
export async function getSpotCrewLogosAction(): Promise<SpotCrewLogoMap> {
  const out: SpotCrewLogoMap = {};
  for (const spot of NN_MOTO_SPOTS) out[spot.slug] = null;

  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("slug, logo_url")
    .in("slug", NN_MOTO_SPOTS.map((s) => s.slug));

  if (error || !data) return out;

  for (const row of data as Array<{ slug: string | null; logo_url: string | null }>) {
    if (row.slug && row.logo_url && row.logo_url.trim()) out[row.slug] = row.logo_url.trim();
  }
  return out;
}
