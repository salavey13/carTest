import { NextRequest, NextResponse } from 'next/server';
import { getMapCapability } from '@/lib/map-actions';

export async function GET(request: NextRequest) {
  const mapId = request.nextUrl.searchParams.get('mapId');
  const crewSlug = request.nextUrl.searchParams.get('crewSlug');
  const identifier = mapId || crewSlug || undefined;

  const result = await getMapCapability(identifier);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || 'Failed to load map capability' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result.data });
}
