"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { MapRidersClientRefactored } from "@/components/map-riders/MapRidersClientRefactored";

export function MapRidersClient({ crew, slug }: { crew: FranchizeCrewVM; slug?: string }) {
  return <MapRidersClientRefactored crew={crew} slug={slug} />;
}
