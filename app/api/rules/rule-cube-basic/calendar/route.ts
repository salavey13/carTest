import { supabaseAnon } from '@/hooks/supabase'; // Используем anon для чтения
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  if (!supabaseAnon) {
    logger.error('[GET /api/rules/rule-cube-basic/calendar] Supabase anon client unavailable.');
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  try {
    logger.info('[GET /api/rules/rule-cube-basic/calendar] Fetching calendar for vehicle_id: rule-cube-basic');
    const { data, error } = await supabaseAnon
      .from('rentals')
      .select('rental_id, requested_start_date, requested_end_date, status, metadata')
      .eq('vehicle_id', 'rule-cube-basic')
      .order('requested_start_date', { ascending: true });

    if (error) {
      logger.error('[GET /api/rules/rule-cube-basic/calendar] Query error:', { message: error.message, details: error.details });
      return NextResponse.json({ error: 'Failed to fetch calendar: ' + error.message }, { status: 500 });
    }

    logger.info('[GET /api/rules/rule-cube-basic/calendar] Calendar data fetched, length:', data?.length);
    // Можно добавить логику для агрегации слотов, но для MVP возвращаем raw bookings
    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('[GET /api/rules/rule-cube-basic/calendar] Unexpected error:', { message: error.message, stack: error.stack });
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}