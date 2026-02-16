import { supabaseAnon } from '@/hooks/supabase'; // Anon for read
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  if (!supabaseAnon) {
    logger.error('[GET /api/my/bookings] Supabase anon client unavailable.');
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId'); // Или из session

  if (!userId) {
    logger.error('[GET /api/my/bookings] Missing userId.');
    return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  }

  try {
    logger.info('[GET /api/my/bookings] Fetching for userId:', userId);
    const { data, error } = await supabaseAnon.rpc('get_user_rentals_dashboard_new', { p_user_id: userId, p_minimal: false });
    
    if (error) {
      logger.error('[GET /api/my/bookings] RPC error details:', { code: error.code, message: error.message, hint: error.hint, details: error.details });
      return NextResponse.json({ error: 'Failed to fetch bookings: ' + error.message }, { status: 500 });
    }

    logger.info('[GET /api/my/bookings] Data fetched successfully, length:', data?.length);
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('[GET /api/my/bookings] Unexpected error details:', { message: error.message, stack: error.stack });
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}