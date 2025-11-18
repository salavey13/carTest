import { NextResponse } from 'next/server';
import { sendComplexMessage } from '@/app/webhook-handlers/actions/sendComplexMessage';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chatId = body?.chatId ?? body?.chat_id ?? null;

    if (!chatId) return NextResponse.json({ success: false }, { status: 400 });

    const checklist = [
      '*🏴‍☠️ THE ANTI-FINE MANIFESTO*',
      'How to stop feeding the marketplaces your profit.',
      '',
      '1. *Kill Ghost Stock:* API Sync must be <5 min delay. Manual sync is suicide.',
      '2. *The Return Trap:* Separate "Refunds" from "Stock" physically on the shelf.',
      '3. *SLA Monitor:* Set alerts 2 hours BEFORE the MP shipment deadline.',
      '4. *Visual Proof:* Photo-fixation at packing. Dispute fines with evidence.',
      '5. *The 2-Week Rule:* Analyze returns data bi-weekly. Spot bad SKUs early.',
      '6. *Safety Buffer:* Keep 5% "Invisible Stock" to prevent overselling.',
      '7. *Barcode Discipline:* No item enters without a scan. No exceptions.',
      '',
      '🚀 *Need the tool we use?* Type /start to launch WarehouseBot.'
    ].join('\n');

    await sendComplexMessage(chatId, checklist, [], { parseMode: 'Markdown' });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}