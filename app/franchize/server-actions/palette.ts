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

  // task: «/sly13 landing have vip-bike palette instead of neon» — the crew
  // theme lives at metadata.franchize.theme (verified across all crews:
  // svarprofi/moto-selection/vip-bike/sly13 — root metadata.theme does not
  // exist anywhere). resolveFranchizeTheme expects the FRANCHIZE object
  // (same call shape as actions-runtime.ts:905); passing the whole metadata
  // made every lookup miss and fall back to DEFAULT_FRANCHIZE_THEME = the
  // vip-bike gold — exactly the «vip-bike palette instead of neon» bug.
  // Defensive fallback keeps resolving if a crew ever stores theme at the
  // metadata root.
  const metadata = (data as { metadata?: unknown }).metadata;
  const franchize =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).franchize ?? metadata
      : {};

  return resolveFranchizeTheme(franchize);
}
