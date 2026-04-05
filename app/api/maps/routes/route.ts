import { NextRequest, NextResponse } from 'next/server';
import { deleteRoute, getPublicRoutesForAdmin, saveRoute, updateRoute } from '@/lib/map-actions';

export async function GET() {
  const result = await getPublicRoutesForAdmin();
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

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const userId = body?.userId ? String(body.userId) : '';
  const mapId = body?.mapId ? String(body.mapId) : '';
  const routeId = body?.routeId ? String(body.routeId) : '';
  if (!userId || !mapId || !routeId) {
    return NextResponse.json({ success: false, error: 'userId, mapId and routeId are required' }, { status: 400 });
  }

  const result = await updateRoute(userId, {
    mapId,
    routeId,
    name: body?.name ? String(body.name) : undefined,
    color: body?.color ? String(body.color) : undefined,
    type: body?.type === 'loop' ? 'loop' : body?.type === 'path' ? 'path' : undefined,
    geojson: body?.geojson ? String(body.geojson) : undefined,
  });
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to update route' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const userId = body?.userId ? String(body.userId) : '';
  const mapId = body?.mapId ? String(body.mapId) : '';
  const routeId = body?.routeId ? String(body.routeId) : '';
  if (!userId || !mapId || !routeId) {
    return NextResponse.json({ success: false, error: 'userId, mapId and routeId are required' }, { status: 400 });
  }

  const result = await deleteRoute(userId, mapId, routeId);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to delete route' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
