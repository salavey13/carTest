import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId'); // Или из session

  try {
    const { data } = await supabase.rpc('get_user_rentals_dashboard', { p_user_id: userId });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GET /api/my/bookings]', error);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}