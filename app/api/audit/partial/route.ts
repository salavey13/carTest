import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  
  try {
    const body = await request.json();
    const { userId, step, answers, estimatedCompletion } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Save partial audit progress
    const { data, error } = await supabase
      .from('audit_progress')
      .upsert({
        user_id: userId,
        current_step: step,
        answers_snapshot: answers,
        estimated_completion: estimatedCompletion,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Partial audit save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}