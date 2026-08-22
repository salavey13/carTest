"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from "@/lib/franchize-config";
import { resolveFranchizeTheme } from "@/app/franchize/lib/theme-resolver";

export async function getCrewPaletteBySlug(slug: string): Promise<FranchizeTheme> {
  const safeSlug = slug.trim().toLowerCase();
  if (!safeSlug) return DEFAULT_FRANCHIZE_THEME;

  const { data, error } = await supabaseAdmin
    .from("crews")
    .select("metadata")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (error || !data) return DEFAULT_FRANCHIZE_THEME;

  return resolveFranchizeTheme((data as { metadata?: unknown }).metadata ?? {});
}
