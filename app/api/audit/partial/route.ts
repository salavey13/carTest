import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/hooks/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, step, answers, estimatedCompletion } = body;

    if (!userId) {
      console.error('❌ Missing userId in partial audit request');
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Save partial audit progress
    const { data, error } = await supabaseAdmin
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

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      throw error;
    }

    console.log('✅ Partial audit saved for user:', userId, 'step:', step);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('💥 Partial audit save error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}