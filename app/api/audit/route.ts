import { NextRequest, NextResponse } from 'next/server';
import { supabaseAnon } from '@/hooks/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, answers, calculation, totalLosses, efficiency, roadmap } = body;

    if (!userId) {
      console.error('❌ Missing userId in audit request');
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Validate data structure
    if (!answers || !calculation) {
      console.error('❌ Invalid data structure:', { hasAnswers: !!answers, hasCalculation: !!calculation });
      return NextResponse.json({ error: 'Invalid data structure' }, { status: 400 });
    }

    // Save full audit report
    const { data, error } = await supabaseAnon
      .from('audit_reports')
      .insert({
        user_id: userId,
        answers,
        calculation,
        total_losses: totalLosses,
        efficiency,
        roadmap,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }

    console.log('✅ Audit report saved successfully for user:', userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('💥 Audit save error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}