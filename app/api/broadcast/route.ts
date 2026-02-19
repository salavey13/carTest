import { NextRequest, NextResponse } from 'next/server';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';
import { notifyAdmin } from '@/app/actions';
import { supabaseAdmin } from '@/hooks/supabase';

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client is not available' }, { status: 500 });
    }

    const { message, senderId } = await req.json();

    if (!message || !senderId) {
      return NextResponse.json({ error: 'Missing message or senderId' }, { status: 400 });
    }

    // Authenticate and check if sender is admin
    const { data: senderData, error: senderError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('user_id', senderId)
      .single();

    if (senderError || !senderData || senderData.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Only admins can broadcast' }, { status: 403 });
    }

    // Fetch all user_ids (exclude admins or bots if needed)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('user_id')
      .eq('role', 'admin'); // Optional: Only admins receiving the broadcast

    if (usersError || !users) {
      throw new Error('Failed to fetch users: ' + (usersError?.message || 'Unknown error'));
    }

    const userIds = users.map((u) => u.user_id);
    let sentCount = 0;

    // Send messages in batches to avoid rate limits (e.g., 30 msgs/sec for Telegram bots)
    for (let i = 0; i < userIds.length; i += 10) {
      const batch = userIds.slice(i, i + 10);
      await Promise.all(
        batch.map(async (userId) => {
          const result = await sendComplexMessage(userId, message, []);
          if (result.success) sentCount++;
        })
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Notify admin about the broadcast result
    await notifyAdmin(`📢 Broadcast completed by ${senderId}:\nMessage: ${message}\nSent to ${sentCount}/${userIds.length} users`);

    return NextResponse.json({ success: true, recipients: sentCount }, { status: 200 });
  } catch (error) {
    console.error('Broadcast error:', error);
    await notifyAdmin(`⚠️ Broadcast failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
