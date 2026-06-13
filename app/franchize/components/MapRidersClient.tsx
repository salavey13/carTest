"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { MapRidersClientRefactored } from "@/components/map-riders/MapRidersClientRefactored";

export function MapRidersClient({ crew, slug, items }: { crew: FranchizeCrewVM; slug?: string; items?: unknown[] }) {
  // Meetup creation and split MapRiders state/actions contexts are centralized
  // in MapRidersClientRefactored/useMapRidersContext, so this franchize
  // entrypoint always consumes the deduplicated, low-rerender flow.
  return <MapRidersClientRefactored crew={crew} slug={slug} items={items} />;
}
