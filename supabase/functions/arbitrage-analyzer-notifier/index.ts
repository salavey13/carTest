import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const log = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// --- Helper Functions ---
async function sendTelegramNotification(botToken: string, chatId: string, message: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    // Escape characters for Telegram's MarkdownV2 parser
    const escapedMessage = message
        .replace(/([_{}\[\]()~>#+\-=|.!])/g, '\\$1');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: escapedMessage, parse_mode: 'MarkdownV2' }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ description: "Unknown Telegram API error" }));
      log(`Error sending Telegram message to ${chatId}: ${response.status} - ${errorData.description}`);
    } else {
      log(`Successfully sent Telegram message to ${chatId}`);
    }
  } catch (e) {
    log(`Failed to send Telegram message to ${chatId}: ${e.message}`);
  }
}

// --- Main Handler ---
serve(async (req: Request) => {
  // 1. --- Auth & Environment ---
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN) {
    log('Missing critical environment variables.');
    return new Response(JSON.stringify({ error: 'Function configuration error.' }), { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  log('Analyzer & Notifier Function Invoked.');

  try {
    // 2. --- Fetch all users with active arbitrage scanning enabled ---
    // (This assumes you have a flag in the `arbitrage_user_settings` table, or you can just fetch all)
    const { data: users, error: userError } = await supabaseAdmin
      .from('arbitrage_user_settings')
      .select('user_id, settings');
      // .eq('settings->>is_scan_active', 'true'); // Example of how to filter for active users

    if (userError) throw userError;
    if (!users || users.length === 0) {
        log('No users found with arbitrage settings. Exiting.');
        return new Response(JSON.stringify({ message: 'No active users to scan for.' }), { status: 200 });
    }
    
    log(`Found ${users.length} user(s) to process.`);

    // 3. --- Fetch all available arbitrage opportunities from the view ---
    const { data: opportunities, error: oppError } = await supabaseAdmin
      .from('arbitrage_opportunities')
      .select('*');

    if (oppError) throw oppError;
    if (!opportunities || opportunities.length === 0) {
        log('No arbitrage opportunities found in the view. Exiting.');
        return new Response(JSON.stringify({ message: 'No current arbitrage opportunities.' }), { status: 200 });
    }

    log(`Found ${opportunities.length} potential opportunities to analyze.`);

    // 4. --- Process opportunities for each user ---
    for (const user of users) {
      const userId = user.user_id;
      const settings = user.settings;

      // Filter opportunities based on this user's settings
      const userOpportunities = opportunities.filter(op => {
        const profit = Math.max(op.potential_profit_pct_a_to_b, op.potential_profit_pct_b_to_a);
        const isPairTracked = settings.trackedPairs.includes(op.symbol);
        const areExchangesEnabled = settings.enabledExchanges.includes(op.exchange_a) && settings.enabledExchanges.includes(op.exchange_b);
        return profit >= settings.minSpreadPercent && isPairTracked && areExchangesEnabled;
      });

      if (userOpportunities.length === 0) {
        log(`No opportunities met criteria for user ${userId}.`);
        continue;
      }
      
      log(`Found ${userOpportunities.length} valid opportunities for user ${userId}. Notifying...`);

      // 5. --- Notify User ---
      for (const op of userOpportunities) {
        const isAtoB = op.potential_profit_pct_a_to_b > op.potential_profit_pct_b_to_a;
        const profit = isAtoB ? op.potential_profit_pct_a_to_b : op.potential_profit_pct_b_to_a;
        const buyExchange = isAtoB ? op.exchange_a : op.exchange_b;
        const sellExchange = isAtoB ? op.exchange_b : op.exchange_a;
        const buyPrice = isAtoB ? op.ask_price_a : op.ask_price_b;
        const sellPrice = isAtoB ? op.bid_price_b : op.bid_price_a;

        const tgMessage = `
🚀 *Arbitrage Alert* 🚀
*Pair:* ${op.symbol}
*Spread:* ${profit.toFixed(2)}%
*Action:*
- Buy on *${buyExchange}* @ ${buyPrice}
- Sell on *${sellExchange}* @ ${sellPrice}
_Please verify before trading_
        `.trim();
        
        await sendTelegramNotification(TELEGRAM_BOT_TOKEN, userId, tgMessage);
      }
    }
    
    return new Response(JSON.stringify({ success: true, message: `Processed ${users.length} users and ${opportunities.length} opportunities.` }), { status: 200 });

  } catch (error) {
    log('Error in Analyzer & Notifier:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});