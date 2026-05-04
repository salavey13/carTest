"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { MapRidersClientRefactored } from "@/components/map-riders/MapRidersClientRefactored";

export function MapRidersClient({ crew, slug }: { crew: FranchizeCrewVM; slug?: string }) {
  // Meetup creation is centralized in MapRidersClientRefactored via useMeetupCreator,
  // so this franchize entrypoint always consumes the deduplicated flow.
  return <MapRidersClientRefactored crew={crew} slug={slug} />;
}
