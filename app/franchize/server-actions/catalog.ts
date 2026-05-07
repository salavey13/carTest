"use server";

import { getFranchizeBySlug as getFranchizeBySlugRuntime, markCrewBikesAvailable as markCrewBikesAvailableRuntime } from "@/app/franchize/actions-runtime";
import type { FranchizeBySlugResult } from "@/app/franchize/actions-runtime";

export async function getFranchizeBySlug(slug: string): Promise<FranchizeBySlugResult> {
  return getFranchizeBySlugRuntime(slug);
}

export async function markCrewBikesAvailable(slug: string) {
  return markCrewBikesAvailableRuntime(slug);
}
