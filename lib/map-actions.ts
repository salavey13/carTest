"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { GeoBounds, validateBounds, PointOfInterest } from "@/lib/map-utils";
import type { MapPreset } from '@/lib/types';
import type { RacingMapData, TileLayerPreset } from "@/lib/maps/map-types";

/**
 * VibeMap Server Actions
 * Dedicated file for all map-related database operations.
 * Clean, minimal, and fully typed.
 */

export async function getMapPresets(): Promise<{ success: boolean; data?: MapPreset[]; error?: string; }> {
  noStore();
  try {
    const { data, error } = await supabaseAdmin.from('maps').select('*');
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[getMapPresets] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function saveMapPreset(
  userId: string,
  name: string,
  map_image_url: string,
  bounds: GeoBounds,
  is_default: boolean = false
): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
  try {
    // Validate bounds before any DB operations
    const validationErrors = validateBounds(bounds);
    if (validationErrors.length > 0) {
      return { success: false, error: `Invalid bounds: ${validationErrors.join('; ')}` };
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (userError || !['admin'].includes(user?.role || '')) {
      throw new Error("Unauthorized: Only admins can save map presets.");
    }

    if (is_default) {
      const { error: updateError } = await supabaseAdmin
        .from('maps')
        .update({ is_default: false })
        .eq('is_default', true);
      if (updateError) {
        throw new Error(`Failed to unset other default maps: ${updateError.message}`);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('maps')
      .insert({
        name,
        map_image_url,
        bounds: bounds as any,
        is_default,
        owner_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[saveMapPreset] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function updateMapPois(
  userId: string,
  mapId: string,
  newPois: PointOfInterest[]
): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (userError || !['admin', 'vprAdmin'].includes(user?.role || '')) {
      throw new Error("Unauthorized: Only admins/vprAdmin can edit maps.");
    }

    const { data, error } = await supabaseAdmin
      .from('maps')
      .update({ points_of_interest: newPois as any })
      .eq('id', mapId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[updateMapPois] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

function normalizePoi(raw: any): PointOfInterest {
  const coords = Array.isArray(raw?.coords)
    ? raw.coords
        .filter((item: any) => Array.isArray(item) && item.length >= 2)
        .map((item: any) => [Number(item[0]), Number(item[1])] as [number, number])
    : [];

  return {
    id: String(raw?.id || crypto.randomUUID()),
    name: String(raw?.name || "Route"),
    type: raw?.type === "point" ? "point" : raw?.type === "loop" ? "loop" : "path",
    icon: String(raw?.icon || "::FaRoute::"),
    color: String(raw?.color || "#22c55e"),
    coords,
    geojson: raw?.geojson,
    roadHighlight: raw?.roadHighlight,
  };
}

function parseTileLayer(value?: string): TileLayerPreset {
  if (value === "cartodb-light" || value === "osm") return value;
  return "cartodb-dark";
}

export async function getMapCapability(identifier?: string): Promise<{ success: boolean; data?: RacingMapData; error?: string; }> {
  noStore();
  try {
    let source: RacingMapData["meta"]["source"] = "default";
    const isUuidIdentifier = Boolean(identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier));
    if (isUuidIdentifier) source = "map-id";
    if (identifier && !isUuidIdentifier) source = "crew-slug";

    const { data: maps, error } = await supabaseAdmin
      .from("maps")
      .select("id,name,bounds,points_of_interest,metadata,is_default,created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!maps?.length) {
      return { success: false, error: "Map preset not found" };
    }

    const defaultMap = maps.find((map) => map.is_default) || maps[0];
    const normalizedIdentifier = identifier?.trim().toLowerCase();

    const primaryMap = isUuidIdentifier
      ? maps.find((map) => map.id === identifier) || defaultMap
      : normalizedIdentifier
        ? maps.find((map) => {
            const metadata = (map.metadata || {}) as Record<string, unknown>;
            const metadataCrewSlug =
              String(metadata.crew_slug || metadata.crewSlug || metadata.slug || "")
                .trim()
                .toLowerCase();
            const matchesName = map.name?.toLowerCase().includes(normalizedIdentifier);
            return metadataCrewSlug === normalizedIdentifier || Boolean(matchesName);
          }) || defaultMap
        : defaultMap;

    const overlayMaps = maps.filter((map) => {
      if (map.id === primaryMap.id || map.id === defaultMap.id) return true;
      if (!normalizedIdentifier || isUuidIdentifier) return false;
      const metadata = (map.metadata || {}) as Record<string, unknown>;
      const metadataCrewSlug = String(metadata.crew_slug || metadata.crewSlug || metadata.slug || "")
        .trim()
        .toLowerCase();
      return metadataCrewSlug === normalizedIdentifier;
    });

    const mapWithPoints = overlayMaps.length ? overlayMaps : [primaryMap];
    const points = mapWithPoints
      .flatMap((map) => (Array.isArray(map.points_of_interest) ? map.points_of_interest.map(normalizePoi).map((poi) => ({ ...poi, id: `${map.id}-${poi.id}` })) : []));

    const routes = points.filter((p) => p.type !== "point");
    const pois = points.filter((p) => p.type === "point");
    const metadata = (primaryMap.metadata || {}) as Record<string, any>;

    return {
      success: true,
      data: {
        mapId: primaryMap.id,
        mapName: primaryMap.name,
        bounds: primaryMap.bounds as GeoBounds,
        points,
        routes,
        pois,
        meta: {
          tileLayer: parseTileLayer(metadata.tileLayer),
          defaultZoom: Number(metadata.defaultZoom || 13),
          minZoom: Number(metadata.minZoom || 10),
          maxZoom: Number(metadata.maxZoom || 19),
          lastUpdated: primaryMap.created_at || new Date().toISOString(),
          source,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[getMapCapability] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function getPublicRacingRoutes(): Promise<{ success: boolean; data?: PointOfInterest[]; error?: string; }> {
  noStore();
  const capability = await getMapCapability();
  if (!capability.success || !capability.data) {
    return { success: false, error: capability.error || "Capability unavailable" };
  }
  return { success: true, data: capability.data.routes };
}

export async function saveRoute(
  userId: string,
  route: {
    name: string;
    color: string;
    geojson: string;
    type: "path" | "loop" | "route";
    mapId?: string;
    icon?: string;
    highlight?: { weight?: number; glow?: boolean; animated?: boolean; dashArray?: string };
  },
): Promise<{ success: boolean; data?: PointOfInterest; error?: string; }> {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (userError || !["admin", "vprAdmin"].includes(user?.role || "")) {
      throw new Error("Unauthorized: Only admins/vprAdmin can save routes.");
    }

    const mapQuery = route.mapId
      ? supabaseAdmin.from("maps").select("id,points_of_interest").eq("id", route.mapId).single()
      : supabaseAdmin.from("maps").select("id,points_of_interest").eq("is_default", true).single();

    const { data: mapPreset, error: mapError } = await mapQuery;
    if (mapError || !mapPreset) throw new Error(mapError?.message || "Default map not found");

    const parsedGeo = JSON.parse(route.geojson);
    const nextRoute: PointOfInterest = {
      id: `route-${crypto.randomUUID()}`,
      name: route.name,
      type: route.type === "loop" ? "loop" : "path",
      icon: route.icon || "::FaRoute::",
      color: route.color,
      coords: [],
      geojson: parsedGeo,
      roadHighlight: {
        weight: route.highlight?.weight ?? (route.type === "loop" ? 6 : 4),
        glow: route.highlight?.glow ?? true,
        animated: route.highlight?.animated ?? false,
        dashArray: route.highlight?.dashArray,
      },
    };

    const existing = Array.isArray(mapPreset.points_of_interest) ? mapPreset.points_of_interest.map(normalizePoi) : [];
    const nextPois = [...existing, nextRoute];

    const { error: updateError } = await supabaseAdmin
      .from("maps")
      .update({ points_of_interest: nextPois as any })
      .eq("id", mapPreset.id);

    if (updateError) throw updateError;
    return { success: true, data: nextRoute };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[saveRoute] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function updateRouteHighlight(
  routeId: string,
  highlight: { weight?: number; glow?: boolean; animated?: boolean; dashArray?: string },
): Promise<{ success: boolean; error?: string; }> {
  try {
    const { data: mapPreset, error: mapError } = await supabaseAdmin
      .from("maps")
      .select("id,points_of_interest")
      .filter("points_of_interest", "cs", `[{"id":"${routeId}"}]`)
      .limit(1)
      .maybeSingle();

    if (mapError) throw mapError;
    if (!mapPreset) return { success: false, error: "Route not found" };

    const existing = Array.isArray(mapPreset.points_of_interest) ? mapPreset.points_of_interest.map(normalizePoi) : [];
    const next = existing.map((poi) =>
      poi.id === routeId ? { ...poi, roadHighlight: { ...poi.roadHighlight, ...highlight } } : poi,
    );

    const { error: updateError } = await supabaseAdmin
      .from("maps")
      .update({ points_of_interest: next as any })
      .eq("id", mapPreset.id);
    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[updateRouteHighlight] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
