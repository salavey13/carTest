// Deno standard library imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Helper function to log messages with a timestamp
const log = (message: string, data?: any) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data || '');
};

// Define interfaces based on your types in the main app
// These should match your /app/elon/arbitrage_scanner_types.ts
interface ArbitrageSettings {
  minSpreadPercent: number;
  enabledExchanges: string[]; // ExchangeName type
  trackedPairs: string[]; 
  defaultTradeVolumeUSD: number;
  exchangeFees: Record<string, { maker: number; taker: number }>;
  networkFees: Record<string, number>;
}

interface ArbitrageOpportunityBase {
  id: string;
  timestamp: string;
  profitPercentage: number;
  potentialProfitUSD: number; 
  tradeVolumeUSD: number;
  currencyPair: string; 
}
interface TwoLegArbitrageOpportunity extends ArbitrageOpportunityBase {
  type: "2-leg";
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  networkFeeUSD: number;
  buyFeePercentage: number;
  sellFeePercentage: number;
  details: string; 
}
// Add ThreeLegArbitrageOpportunity if you implement it here

// Function to fetch user settings from Supabase
async function getUserSettings(supabaseAdmin: any, userId: string): Promise<ArbitrageSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('arbitrage_user_settings')
    .select('settings')
    .eq('user_id', userId)
    .single();
  if (error) {
    log(`Error fetching settings for user ${userId}: ${error.message}`);
    return null;
  }
  return data ? (data.settings as ArbitrageSettings) : null;
}

// Mock function to simulate fetching order book from an exchange API
// In a real scenario, this would make an HTTP request using fetch()
async function fetchOrderBook(exchange: string, pair: string): Promise<{ asks: [number, number][]; bids: [number, number][]; } | null> {
  log(`Simulating API call to ${exchange} for pair ${pair}`);
  // Replace with actual API call logic
  // Example: const response = await fetch(`https://api.${exchange}.com/v1/orderbook?pair=${pair}`);
  // const data = await response.json();
  // For now, return mock data
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200)); // Simulate network delay
  
  let basePrice;
  if (pair.startsWith("BTC")) basePrice = 65000 + (Math.random() - 0.5) * 500;
  else if (pair.startsWith("ETH")) basePrice = 3500 + (Math.random() - 0.5) * 50;
  else basePrice = 150 + (Math.random() - 0.5) * 10;

  const spread = basePrice * (0.0002 + Math.random() * 0.0005); // Tiny spread for real exchanges
  return {
    asks: [[parseFloat((basePrice + spread / 2).toFixed(2)), Math.random() * 5 + 0.1]], // [[price, volume]]
    bids: [[parseFloat((basePrice - spread / 2).toFixed(2)), Math.random() * 5 + 0.1]],
  };
}

// Function to send Telegram notification
async function sendTelegramNotification(botToken: string, chatId: string, message: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'MarkdownV2' }), // Use MarkdownV2 for more formatting options
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

// Main handler for the Edge Function
serve(async (req: Request) => {
  // 1. --- Auth and Env Vars ---
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}` && req.method === 'POST') { // Allow GET for manual trigger without secret for testing?
    log('Unauthorized attempt to trigger arbitrage scan.');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN) {
    log('Missing critical environment variables for Supabase or Telegram.');
    return new Response(JSON.stringify({ error: 'Function configuration error.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  log('Arbitrage Scan Instance Function Invoked.');

  // 2. --- Determine Target User(s) ---
  // This example processes one user. For CRON, you might fetch all users with active arbitrage scanning.
  // For client-triggered, userId would come from request body or query params.
  // For simplicity, let's assume we process a predefined test user for now.
  // Or, if called with a body: const { userId } = await req.json();
  
  const reqBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const targetUserId = reqBody.userId || Deno.env.get('TEST_USER_ID_FOR_ARBITRAGE_SCAN'); // Example: Get from body or ENV

  if (!targetUserId) {
    log('No targetUserId provided for scan.');
    return new Response(JSON.stringify({ error: 'User ID to scan for is required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  
  log(`Processing scan for user: ${targetUserId}`);

  // 3. --- Fetch User Settings ---
  const settings = await getUserSettings(supabaseAdmin, targetUserId);
  if (!settings) {
    log(`No settings found for user ${targetUserId}. Aborting scan.`);
    return new Response(JSON.stringify({ message: `No arbitrage settings for user ${targetUserId}.`}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  log(`Settings loaded for ${targetUserId}: ${settings.enabledExchanges.length} exchanges, ${settings.trackedPairs.length} pairs.`);

  // 4. --- Perform Arbitrage Scan (Simplified 2-leg example) ---
  const foundOpportunities: TwoLegArbitrageOpportunity[] = [];
  const scanRunLogs: string[] = [`Scan started for ${targetUserId} at ${new Date().toISOString()}`];

  for (const pair of settings.trackedPairs) {
    if (settings.enabledExchanges.length < 2) continue;

    const assetToTransfer = pair.split('/')[0];
    const networkFeeKey = settings.networkFees[assetToTransfer + "_ERC20"] !== undefined ? assetToTransfer + "_ERC20" 
                        : settings.networkFees[assetToTransfer + "_TRC20"] !== undefined ? assetToTransfer + "_TRC20" 
                        : assetToTransfer;
    const networkFee = settings.networkFees[networkFeeKey] ?? 1;

    for (let i = 0; i < settings.enabledExchanges.length; i++) {
      for (let j = 0; j < settings.enabledExchanges.length; j++) {
        if (i === j) continue;

        const exchangeA = settings.enabledExchanges[i];
        const exchangeB = settings.enabledExchanges[j];
        
        // Rate limiting: a small delay between pairs of exchanges for a given asset
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay

        const bookA = await fetchOrderBook(exchangeA, pair);
        const bookB = await fetchOrderBook(exchangeB, pair);

        if (!bookA || !bookB || bookA.asks.length === 0 || bookA.asks[0].length < 2 || bookB.bids.length === 0 || bookB.bids[0].length < 2) {
          scanRunLogs.push(`Could not fetch order book for ${pair} on ${exchangeA} or ${exchangeB}`);
          continue;
        }

        const priceToBuyOnA_ask = bookA.asks[0][0];
        const priceToSellOnB_bid = bookB.bids[0][0];

        const feeA_taker = settings.exchangeFees[exchangeA]?.taker ?? 0.001;
        const feeB_taker = settings.exchangeFees[exchangeB]?.taker ?? 0.001;

        const costPerUnitOnA = priceToBuyOnA_ask * (1 + feeA_taker);
        const revenuePerUnitOnB = priceToSellOnB_bid * (1 - feeB_taker);
        
        const amountOfAsset = settings.defaultTradeVolumeUSD / costPerUnitOnA;
        const totalInvestment = settings.defaultTradeVolumeUSD;
        const totalRevenueFromSale = amountOfAsset * revenuePerUnitOnB;
        const profitInQuoteCurrency = totalRevenueFromSale - totalInvestment - networkFee;
        const profitPercentage = (profitInQuoteCurrency / totalInvestment) * 100;

        if (profitPercentage > settings.minSpreadPercent) {
          const opportunityId = crypto.randomUUID(); // Deno's way for UUID
          const newOp: TwoLegArbitrageOpportunity = {
            id: opportunityId,
            type: "2-leg",
            timestamp: new Date().toISOString(),
            currencyPair: pair,
            buyExchange: exchangeA,
            sellExchange: exchangeB,
            buyPrice: priceToBuyOnA_ask,
            sellPrice: priceToSellOnB_bid,
            profitPercentage: parseFloat(profitPercentage.toFixed(3)),
            potentialProfitUSD: parseFloat(profitInQuoteCurrency.toFixed(2)),
            tradeVolumeUSD: settings.defaultTradeVolumeUSD,
            networkFeeUSD: networkFee,
            buyFeePercentage: feeA_taker * 100,
            sellFeePercentage: feeB_taker * 100,
            details: `Buy ${assetToTransfer} on ${exchangeA} @ ${priceToBuyOnA_ask.toFixed(4)}, Sell on ${exchangeB} @ ${priceToSellOnB_bid.toFixed(4)}. Net fee: ${networkFee}$`,
          };
          foundOpportunities.push(newOp);
          scanRunLogs.push(`Found 2-leg: ${exchangeA} -> ${exchangeB} for ${pair}, Profit: ${profitPercentage.toFixed(2)}% ($${profitInQuoteCurrency.toFixed(2)})`);
          
          // Send Telegram Notification
          const tgMessage = `
🚀 *New Arbitrage Opportunity* 🚀
Pair: \`${pair}\`
Buy on: *${exchangeA}* @ \`${priceToBuyOnA_ask.toFixed(4)}\`
Sell on: *${exchangeB}* @ \`${priceToSellOnB_bid.toFixed(4)}\`
Spread: *${profitPercentage.toFixed(2)}%*
Potential Profit: *$${profitInQuoteCurrency.toFixed(2)}* (for $${settings.defaultTradeVolumeUSD} volume)
Network Fee: $${networkFee}
          `.trim().replace(/\./g, '\\.').replace(/-/g, '\\-').replace(/!/g, '\\!').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); // Escape for MarkdownV2
          await sendTelegramNotification(TELEGRAM_BOT_TOKEN, targetUserId, tgMessage);
        }
      }
    }
  }
  scanRunLogs.push(`Scan finished. Found ${foundOpportunities.length} opportunities.`);
  log(scanRunLogs.join('\n'));

  // 5. --- Store Scan Results (Optional) ---
  // You might want to save foundOpportunities or scanRunLogs to a Supabase table.
  // Example:
  // if (foundOpportunities.length > 0) {
  //   const { error: insertError } = await supabaseAdmin.from('arbitrage_finds').insert(foundOpportunities);
  //   if (insertError) log(`Error saving opportunities: ${insertError.message}`);
  // }

  return new Response(JSON.stringify({
    message: `Scan for user ${targetUserId} completed.`,
    opportunitiesFound: foundOpportunities.length,
    logs: scanRunLogs,
    // opportunities: foundOpportunities // Optionally return opportunities
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});

/*
To Deploy & Schedule:
1. Set ENV Vars in Supabase Dashboard for this function:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - TELEGRAM_BOT_TOKEN
   - CRON_SECRET (for authorizing cron trigger)
   - TEST_USER_ID_FOR_ARBITRAGE_SCAN (optional, for testing)
2. Deploy: `supabase functions deploy arbitrage-scan-instance --no-verify-jwt`
3. Schedule (e.g., every 5 minutes for user-specific scans, or less frequently for batch scans):
   `SELECT cron.schedule('arbitrage-scan-user-TARGETUSERID', '*/5 * * * *', 'SELECT net.http_post(url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/arbitrage-scan-instance'', headers:=''{"Authorization": "Bearer YOUR_CRON_SECRET", "Content-Type": "application/json"}'', body:=''{"userId": "TARGET_USER_ID"}''::jsonb)');`
   Replace YOUR_PROJECT_REF, YOUR_CRON_SECRET, and TARGET_USER_ID.
   Or for a generic run (if function logic supports batching users):
   `SELECT cron.schedule('arbitrage-scan-batch', '0 * * * *', 'SELECT net.http_post(url:=''https://YOUR_PROJECT_REF.supabase.co/functions/v1/arbitrage-scan-instance'', headers:=''{"Authorization": "Bearer YOUR_CRON_SECRET"}'')');`
*/