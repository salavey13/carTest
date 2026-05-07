"use server";

import { loadFranchizeConfigBySlug as loadFranchizeConfigBySlugRuntime, saveFranchizeConfig as saveFranchizeConfigRuntime } from "@/app/franchize/actions-runtime";
import type { FranchizeConfigInput, FranchizeConfigState } from "@/app/franchize/actions-runtime";

export async function loadFranchizeConfigBySlug(slug: string, actorUserId?: string): Promise<FranchizeConfigState> {
  return loadFranchizeConfigBySlugRuntime(slug, actorUserId);
}

export async function saveFranchizeConfig(input: FranchizeConfigInput, actorUserId?: string): Promise<FranchizeConfigState> {
  return saveFranchizeConfigRuntime(input, actorUserId);
}
