import { NextRequest, NextResponse } from 'next/server';
import { getPublicRacingRoutes, saveRoute } from '@/lib/map-actions';

export async function GET() {
  const result = await getPublicRacingRoutes();
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to load routes' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data || [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = body?.userId;
  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }

  const routePayload = {
    name: String(body?.name || ''),
    color: String(body?.color || '#22c55e'),
    type: body?.type === 'loop' ? 'loop' : 'path',
    geojson: String(body?.geojson || ''),
    mapId: body?.mapId ? String(body.mapId) : undefined,
    icon: body?.icon ? String(body.icon) : undefined,
    highlight: body?.highlight,
  } as const;

  if (!routePayload.name || !routePayload.geojson) {
    return NextResponse.json({ success: false, error: 'name and geojson are required' }, { status: 400 });
  }

  const result = await saveRoute(userId, routePayload);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to save route' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
