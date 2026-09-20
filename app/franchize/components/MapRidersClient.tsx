"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { MapRidersClientRefactored, type MapRidersWallParams } from "@/components/map-riders/MapRidersClientRefactored";

export function MapRidersClient({ crew, slug, items, wallParams }: { crew: FranchizeCrewVM; slug?: string; items?: unknown[]; wallParams?: MapRidersWallParams }) {
  // Meetup creation and split MapRiders state/actions contexts are centralized
  // in MapRidersClientRefactored/useMapRidersContext, so this franchize
  // entrypoint always consumes the deduplicated, low-rerender flow.
  // wallParams: deep-links (?post=|ride=|compose=|spot=|q=) → the wall sheet.
  return <MapRidersClientRefactored crew={crew} slug={slug} items={items} wallParams={wallParams} />;
}
