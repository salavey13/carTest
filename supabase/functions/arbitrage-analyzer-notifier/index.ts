import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const log = (message: string, data?: any) => {
  console.log(`[analyzer-notifier] ${new Date().toISOString()}: ${message}`, data || '');
};

const NOTIFICATION_COOLDOWN_MINUTES = 60;

Deno.serve(async (req: Request) => {
  const CUSTOM_AUTH_SECRET = Deno.env.get('CRON_SECRET')!;
  const receivedSecret = req.headers.get('X-Vibe-Auth-Secret');

  if (receivedSecret !== CUSTOM_AUTH_SECRET) {
    log('Unauthorized: Missing or incorrect X-Vibe-Auth-Secret header.');
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid secret.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  log('Function invoked securely.');

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VERCEL_API_ENDPOINT = Deno.env.get('VERCEL_NOTIFICATION_API_ENDPOINT')!;
    const CRON_SECRET_FOR_VERCEL = Deno.env.get('CRON_SECRET')!;
    
    if (!VERCEL_API_ENDPOINT) {
        throw new Error("VERCEL_NOTIFICATION_API_ENDPOINT is not set in environment variables.");
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [usersRes, opportunitiesRes] = await Promise.all([
        supabaseAdmin.from('arbitrage_user_settings').select('user_id, settings'),
        supabaseAdmin.from('arbitrage_opportunities').select('*')
    ]);

    if (usersRes.error) throw usersRes.error;
    if (opportunitiesRes.error) throw opportunitiesRes.error;
    
    const users = usersRes.data || [];
    const opportunities = opportunitiesRes.data || [];

    if (users.length === 0 || opportunities.length === 0) {
        log('No active users or opportunities found. Exiting.');
        return new Response(JSON.stringify({ message: 'No active users or opportunities.' }), { status: 200 });
    }
    log(`Analyzing ${opportunities.length} opportunities for ${users.length} users.`);

    for (const user of users) {
      const userId = user.user_id;
      const settings = user.settings;

      if (!settings?.trackedPairs || !settings.enabledExchanges) continue;

      const userOpportunities = opportunities.filter(op => {
        const profit = Math.max(op.potential_profit_pct_a_to_b, op.potential_profit_pct_b_to_a);
        return profit >= settings.minSpreadPercent &&
               settings.trackedPairs.includes(op.symbol) &&
               settings.enabledExchanges.includes(op.exchange_a) &&
               settings.enabledExchanges.includes(op.exchange_b);
      });

      if (userOpportunities.length === 0) continue;
      
      for (const op of userOpportunities) {
        const isAtoB = op.potential_profit_pct_a_to_b > op.potential_profit_pct_b_to_a;
        const buyExchange = isAtoB ? op.exchange_a : op.exchange_b;
        const sellExchange = isAtoB ? op.exchange_b : op.exchange_a;
        const profit = isAtoB ? op.potential_profit_pct_a_to_b : op.potential_profit_pct_b_to_a;
        
        const opportunitySignature = `${op.symbol}:${buyExchange}->${sellExchange}`;
        
        const { data: existingNotification, error: checkError } = await supabaseAdmin
            .from('notified_opportunities')
            .select('cooldown_expires_at')
            .eq('user_id', userId)
            .eq('opportunity_signature', opportunitySignature)
            .maybeSingle();

        if (checkError) {
            log(`Error checking cooldown for user ${userId}, signature ${opportunitySignature}`, checkError);
            continue;
        }

        if (existingNotification && new Date(existingNotification.cooldown_expires_at) > new Date()) {
            log(`Cooldown active for ${opportunitySignature} for user ${userId}. Skipping notification.`);
            continue;
        }

        log(`Cooldown clear. Triggering notification API for ${opportunitySignature} to user ${userId}.`);
        const tgMessage = `🚀 Arbitrage Alert: *${profit.toFixed(2)}%* spread on *${op.symbol}*\n\n- Buy on: *${buyExchange}*\n- Sell on: *${sellExchange}*`;
        
        // Asynchronously call our Vercel endpoint with ITS OWN Bearer secret
        fetch(VERCEL_API_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // This Authorization is for OUR Vercel API route, NOT Supabase.
                'Authorization': `Bearer ${CRON_SECRET_FOR_VERCEL}` 
            },
            body: JSON.stringify({ chatId: userId, message: tgMessage })
        }).catch(e => log("Error triggering notification API (fire-and-forget)", e.message));

        const cooldownExpires = new Date(new Date().getTime() + NOTIFICATION_COOLDOWN_MINUTES * 60000).toISOString();
        const { error: upsertError } = await supabaseAdmin
            .from('notified_opportunities')
            .upsert({
                user_id: userId,
                opportunity_signature: opportunitySignature,
                last_notified_at: new Date().toISOString(),
                cooldown_expires_at: cooldownExpires
            }, { onConflict: 'user_id,opportunity_signature' });

        if (upsertError) {
            log(`Error setting cooldown for ${opportunitySignature}`, upsertError);
        }
      }
    }
    
    return new Response(JSON.stringify({ success: true, message: `Processed ${users.length} users.` }), { status: 200 });

  } catch (error) {
    log('Critical error in edge function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});