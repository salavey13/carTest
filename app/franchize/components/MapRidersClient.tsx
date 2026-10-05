"use client";

import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { MapRidersClientRefactored, type MapRidersWallParams } from "@/components/map-riders/MapRidersClientRefactored";
import type { CrewNetworkModelResult } from "@/app/franchize/discovery/load-network-model";

export function MapRidersClient({
  crew,
  slug,
  items,
  wallParams,
  network,
}: {
  crew: FranchizeCrewVM;
  slug?: string;
  items?: unknown[];
  wallParams?: MapRidersWallParams;
  /** Task 74: the server-loaded network model (bloggers etc.) — the page
   *  loads it once; the old wrapper silently DROPPED it, so the map sheet's
   *  network tab and the wall-pin blogger chips never saw the data. */
  network?: CrewNetworkModelResult | null;
}) {
  // Meetup creation and split MapRiders state/actions contexts are centralized
  // in MapRidersClientRefactored/useMapRidersContext, so this franchize
  // entrypoint always consumes the deduplicated, low-rerender flow.
  // wallParams: deep-links (?post=|ride=|compose=|spot=|q=) → the wall sheet.
  return <MapRidersClientRefactored crew={crew} slug={slug} items={items} wallParams={wallParams} network={network} />;
}
