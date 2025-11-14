import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const body = await request.json();
    const { userId, answers, calculation, totalLosses, efficiency, recommendations, roadmap } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Save full audit report
    const { data, error } = await supabase
      .from('audit_reports')
      .insert({
        user_id: userId,
        answers,
        calculation,
        total_losses: totalLosses,
        efficiency,
        recommendations,
        roadmap,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Audit save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}