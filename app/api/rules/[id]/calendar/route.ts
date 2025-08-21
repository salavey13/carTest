import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  try {
    // Hardcoded для MVP: игнорируем params.id, используем 'rule-cube-basic'
    const { data, error } = await supabase.rpc('get_vehicle_calendar', { p_vehicle_id: 'rule-cube-basic' });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('[GET /api/rules/[id]/calendar]', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}