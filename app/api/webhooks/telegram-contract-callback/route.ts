// /app/api/webhooks/telegram-contract-callback/route.ts
import { createClient } from '@supabase/supabase-js';
import { approveContract, declineContract } from '@/app/franchize/server-actions/rentals';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Optional: set TELEGRAM_CALLBACK_SECRET to require authentication
const CALLBACK_SECRET = process.env.TELEGRAM_CALLBACK_SECRET || process.env.CODEX_BRIDGE_CALLBACK_SECRET;

export async function POST(request: Request) {
  // Verify bot token is configured
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('[telegram-contract-callback] TELEGRAM_BOT_TOKEN not configured');
    return Response.json({ ok: false, error: 'Server configuration error' }, { status: 500 });
  }

  // Verify callback secret if configured
  if (CALLBACK_SECRET) {
    const authHeader = request.headers.get('x-telegram-callback-secret');
    if (authHeader !== CALLBACK_SECRET) {
      console.error('[telegram-contract-callback] Invalid or missing secret');
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const { callback_query, message } = body;

    // Handle callback query (button press)
    if (callback_query) {
      const { data, id, from, message: msg } = callback_query;
      const [action, rentalId, draftId] = data.split(':');

      // Acknowledge the callback
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: id }),
      });

      if (action === 'approve_contract') {
        // Get rental details with crew (join through vehicle)
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!);
        const { data: rental } = await supabase
          .from('rentals')
          .select('vehicle_id, vehicle:cars(crew:crews(slug))')
          .eq('rental_id', rentalId)
          .single();

        if (!rental || !rental.vehicle?.crew?.slug) {
          await sendErrorMessage(msg.chat.id, 'Аренда не найдена');
          return Response.json({ ok: true });
        }

        const result = await approveContract({
          rentalId,
          crewSlug: rental.vehicle.crew.slug,
          bikeId: rental.vehicle_id,
          contractDraftId: draftId,
          actorTelegramUserId: String(from.id),
        });

        if (result.success) {
          await sendMessage(msg.chat.id, `✅ Договор утвержден и отправлен!\n\nСкачать: ${result.downloadUrl}`);
        } else {
          await sendErrorMessage(msg.chat.id, result.error || 'Ошибка при утверждении');
        }

      } else if (action === 'decline_contract') {
        const result = await declineContract({
          rentalId,
          contractDraftId: draftId,
          actorTelegramUserId: String(from.id),
        });

        if (result.success) {
          await sendMessage(msg.chat.id, '✗ Запрос на договор отклонен. Арендатор уведомлен.');
        } else {
          await sendErrorMessage(msg.chat.id, result.error || 'Ошибка при отклонении');
        }
      }

      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error('[telegram-contract-callback] Error:', error);
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

async function sendMessage(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

async function sendErrorMessage(chatId: number | string, error: string) {
  await sendMessage(chatId, `❌ Ошибка: ${error}`);
}
