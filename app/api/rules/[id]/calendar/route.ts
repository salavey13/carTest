import { supabaseAnon } from '@/hooks/supabase'; // Use anon for read
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!supabaseAnon) {
    logger.error('[GET /api/rules/[id]/calendar] Supabase anon client unavailable.');
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  try {
    // Hardcoded для MVP: игнорируем params.id, используем 'rule-cube-basic'
    const { data, error } = await supabaseAnon.rpc('get_vehicle_calendar', { p_vehicle_id: 'rule-cube-basic' });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    logger.error('[GET /api/rules/[id]/calendar]', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}