#!/usr/bin/env node

/**
 * Migration helper: converts legacy map points_of_interest coords into GeoJSON routes,
 * and can seed real road-snapped routes via OSRM between key intersections.
 *
 * Usage:
 *   npx tsx scripts/migrate-maps-to-geojson.ts --map-id <uuid>
 */

import process from 'node:process';
import { spawnSync } from 'node:child_process';

type LegacyPoi = {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords?: [number, number][];
  geojson?: any;
  roadHighlight?: { weight?: number; glow?: boolean; animated?: boolean; dashArray?: string };
};

function getArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function osrmLineFromWaypoints(coords: [number, number][]) {
  // OSRM expects lon,lat in query string
  const query = coords.map(([lat, lon]) => `${lon},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${query}?overview=full&geometries=geojson&steps=false`;
  const body = await requestJson(url);
  const geometry = body?.routes?.[0]?.geometry;
  if (!geometry) {
    throw new Error('OSRM route geometry missing');
  }
  return {
    type: 'Feature',
    geometry,
    properties: {
      provider: 'osrm',
      generatedAt: new Date().toISOString(),
    },
  };
}

async function requestJson(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch {
    const args = ['-sS', url];
    if (init?.method && init.method !== 'GET') args.unshift('-X', init.method);
    if (init?.headers) {
      for (const [key, value] of Object.entries(init.headers as Record<string, string>)) {
        args.push('-H', `${key}: ${value}`);
      }
    }
    if (init?.body) {
      args.push('-d', typeof init.body === 'string' ? init.body : JSON.stringify(init.body));
    }
    const curl = spawnSync('curl', args, { encoding: 'utf8' });
    if (curl.status !== 0) {
      throw new Error(curl.stderr || curl.stdout || 'curl request failed');
    }
    return JSON.parse(curl.stdout || '{}');
  }
}

function legacyToGeojson(poi: LegacyPoi) {
  if (poi.type === 'point' || !poi.coords?.length) return poi;
  const line = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: poi.coords.map(([lat, lon]) => [lon, lat]),
    },
    properties: {
      source: 'legacy-coords',
    },
  };

  return {
    ...poi,
    geojson: poi.geojson || line,
    roadHighlight: poi.roadHighlight || {
      weight: poi.type === 'loop' ? 6 : 4,
      glow: true,
      animated: false,
    },
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const mapId = getArg('map-id');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const selectUrl = mapId
    ? `${supabaseUrl}/rest/v1/maps?id=eq.${mapId}&select=id,name,points_of_interest`
    : `${supabaseUrl}/rest/v1/maps?is_default=eq.true&select=id,name,points_of_interest&limit=1`;

  const mapRows = await requestJson(selectUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  const map = Array.isArray(mapRows) ? mapRows[0] : null;
  if (!map?.id) {
    throw new Error('Map record not found');
  }

  const existing = Array.isArray(map.points_of_interest) ? (map.points_of_interest as LegacyPoi[]) : [];
  const transformed = existing.map(legacyToGeojson);

  // Add two real road-snapped examples from Nizhny intersections.
  const bigRingWaypoints: [number, number][] = [
    [56.3300, 44.0180],
    [56.3283, 44.0059],
    [56.3262, 43.9871],
    [56.3150, 43.9875],
    [56.3070, 44.0030],
    [56.3130, 44.0200],
    [56.3250, 44.0270],
    [56.3300, 44.0180],
  ];

  const embankmentWaypoints: [number, number][] = [
    [56.3307, 44.0195],
    [56.3302, 44.0298],
    [56.3253, 44.0273],
    [56.3225, 44.0200],
  ];

  const [bigRingGeo, embankmentGeo] = await Promise.all([
    osrmLineFromWaypoints(bigRingWaypoints),
    osrmLineFromWaypoints(embankmentWaypoints),
  ]);

  transformed.push(
    {
      id: 'geo-big-ring-race',
      name: 'Большое Кольцо • Geo Road',
      type: 'loop',
      icon: '::FaRoute::',
      color: '#4D99FF',
      coords: bigRingWaypoints,
      geojson: bigRingGeo,
      roadHighlight: { weight: 6, glow: true, animated: false },
    },
    {
      id: 'geo-embankment-fury',
      name: 'Набережная Фурия • Geo Road',
      type: 'path',
      icon: '::FaWater::',
      color: '#FF66B2',
      coords: embankmentWaypoints,
      geojson: embankmentGeo,
      roadHighlight: { weight: 4, glow: true, animated: false, dashArray: '12, 8' },
    },
  );

  const metadata = {
    tileLayer: 'cartodb-dark',
    defaultZoom: 13,
    minZoom: 10,
    maxZoom: 19,
    geoMigrationAt: new Date().toISOString(),
  };

  let updated;
  try {
    updated = await requestJson(`${supabaseUrl}/rest/v1/maps?id=eq.${map.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ points_of_interest: transformed, metadata }),
    });
    if (updated?.code && updated?.message) {
      throw new Error(updated.message);
    }
  } catch {
    updated = await requestJson(`${supabaseUrl}/rest/v1/maps?id=eq.${map.id}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ points_of_interest: transformed }),
    });
    if (updated?.code && updated?.message) {
      throw new Error(updated.message);
    }
  }
  console.log(JSON.stringify({ success: true, mapId: map.id, routes: transformed.filter((p) => p.type !== 'point').length, updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
