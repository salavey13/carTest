"use server";
import { logger } from "@/lib/logger";
import { sendTelegramMessage } from "@/app/actions"; // Assuming this is the correct path to main actions
import { 
  ArbitrageOpportunity, 
  TwoLegArbitrageOpportunity, 
  ThreeLegArbitrageOpportunity,
  ExchangeName,
  ArbitrageSettings,
  DEFAULT_ARBITRAGE_SETTINGS,
  ALL_POSSIBLE_EXCHANGES_CONST
} from "./arbitrage_scanner_types";
import {
    fetchUserArbitrageSettingsFromDB,
    saveUserArbitrageSettingsToDB
} from "./arbitrage_supabase_actions";
import { v4 as uuidv4 } from 'uuid';

// Helper for Telegram notifications
async function notifyArbitrageAction(userId: string, message: string, isAdminNotification: boolean = false) {
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
    if (isAdminNotification && ADMIN_CHAT_ID) {
        await sendTelegramMessage(message, [], undefined, ADMIN_CHAT_ID);
    } else if (!isAdminNotification) {
        await sendTelegramMessage(message, [], undefined, userId);
    }
}

export async function getArbitrageScannerSettings(userId: string): Promise<{success: boolean, data?: ArbitrageSettings, error?: string}> {
  logger.info(`[ArbitrageActions] Getting settings for user ${userId}.`);
  const result = await fetchUserArbitrageSettingsFromDB(userId);
  if (!result.success || !result.data) {
      logger.warn(`[ArbitrageActions] Failed to fetch settings for user ${userId} from DB or no settings found. Falling back to defaults. Error: ${result.error}`);
      // Ensure a default structure is always returned if DB fetch fails or finds nothing
      return { success: true, data: { ...DEFAULT_ARBITRAGE_SETTINGS } };
  }
  // The data from DB might be partial if schema changed, merge with defaults.
  // fetchUserArbitrageSettingsFromDB already merges with defaults.
  return { success: true, data: result.data };
}


export async function updateArbitrageUserSettings(
    userId: string, 
    newSettings: ArbitrageSettings // Expect full settings object, matching the type
): Promise<{success: boolean, data?: ArbitrageSettings, error?: string}> {
  logger.info(`[ArbitrageActions] Attempting to update settings for user ${userId}`, newSettings);
  
  // Validate incoming settings structure if necessary, or assume it's correct
  // For example, ensure all required fields are present in newSettings.
  // The `ArbitrageSettings` type itself serves as a good structural contract.

  const saveResult = await saveUserArbitrageSettingsToDB(userId, newSettings);

  if (saveResult.success) {
    logger.info(`[ArbitrageActions] Settings successfully saved to DB for user ${userId}.`);
    await notifyArbitrageAction(userId, "⚙️ Ваши настройки арбитражного сканера успешно сохранены!");
    return { success: true, data: newSettings };
  } else {
    logger.error(`[ArbitrageActions] Failed to save settings to DB for user ${userId}: ${saveResult.error}`);
    await notifyArbitrageAction(userId, `⚠️ Ошибка сохранения настроек: ${saveResult.error}`);
    return { success: false, error: saveResult.error, data: newSettings }; // return newSettings to keep UI state
  }
}

const simulateOrderBook = (pair: string, exchange: ExchangeName) => {
  let basePrice;
  if (pair.startsWith("BTC")) basePrice = 65000 + (Math.random() - 0.5) * 2000; 
  else if (pair.startsWith("ETH")) basePrice = 3500 + (Math.random() - 0.5) * 200;
  else if (pair.startsWith("SOL")) basePrice = 150 + (Math.random() - 0.5) * 20;
  else if (pair.endsWith("BTC") && pair.startsWith("ETH")) basePrice = 0.053 + (Math.random() - 0.5) * 0.002; // ETH/BTC
  else basePrice = 1 + (Math.random() - 0.5) * 0.1;

  const exchangeFactor = exchange === "SimulatedExchangeA" ? 1.0005 : exchange === "SimulatedExchangeB" ? 0.9995 : 1.0;
  basePrice *= exchangeFactor;

  const midPrice = basePrice * (1 + (Math.random() - 0.5) * 0.005); 
  const spread = midPrice * (0.0005 + Math.random() * 0.001); 
  
  return {
    bids: [[parseFloat((midPrice - spread / 2).toFixed(pair.endsWith("BTC") ? 8 : 4)), Math.random() * 10 + 1]], 
    asks: [[parseFloat((midPrice + spread / 2).toFixed(pair.endsWith("BTC") ? 8 : 4)), Math.random() * 10 + 1]],
  };
};

export async function fetchArbitrageOpportunities(userId: string): Promise<{
  opportunities: ArbitrageOpportunity[];
  logs: string[];
  settings?: ArbitrageSettings; 
}> {
  logger.info(`[ArbitrageActions] Simulating arbitrage scan for user ${userId}...`);
  const logs: string[] = [];
  const opportunities: ArbitrageOpportunity[] = [];

  const settingsResult = await getArbitrageScannerSettings(userId); 
  if (!settingsResult.success || !settingsResult.data) {
    logs.push("Error: Could not load user settings for the scan.");
    logger.error(`[ArbitrageActions] Failed to load settings for user ${userId} during scan.`);
    return { opportunities, logs, settings: undefined };
  }
  const currentSettings = settingsResult.data;

  logs.push(`Scan started with min spread: ${currentSettings.minSpreadPercent}%, trade volume: $${currentSettings.defaultTradeVolumeUSD}`);
  logs.push(`Enabled exchanges: ${currentSettings.enabledExchanges.join(', ')}`);
  logs.push(`Tracked pairs: ${currentSettings.trackedPairs.join(', ')}`);

  if (currentSettings.enabledExchanges.length < 2 && currentSettings.trackedPairs.length > 0) {
      logs.push("Warning: At least two exchanges must be enabled for 2-leg arbitrage simulation.");
  }
  
  const exchangesToScan = currentSettings.enabledExchanges.length > 0 ? currentSettings.enabledExchanges : ALL_POSSIBLE_EXCHANGES_CONST;

  // Simulate 2-leg opportunities
  for (const pair of currentSettings.trackedPairs) {
    if (exchangesToScan.length < 2) continue; 

    const assetToTransfer = pair.split('/')[0]; 
    const networkFeeKey = currentSettings.networkFees[assetToTransfer + "_ERC20"] !== undefined ? assetToTransfer + "_ERC20" 
                        : currentSettings.networkFees[assetToTransfer + "_TRC20"] !== undefined ? assetToTransfer + "_TRC20" 
                        : assetToTransfer;
    const networkFee = currentSettings.networkFees[networkFeeKey] ?? 1;


    for (let i = 0; i < exchangesToScan.length; i++) {
      for (let j = 0; j < exchangesToScan.length; j++) {
        if (i === j) continue; 

        const exchangeA = exchangesToScan[i];
        const exchangeB = exchangesToScan[j];

        logs.push(`Scanning pair ${pair} between ${exchangeA} and ${exchangeB}`);
        const bookA = simulateOrderBook(pair, exchangeA);
        const bookB = simulateOrderBook(pair, exchangeB);

        const priceToBuyOnA_ask = bookA.asks[0][0]; 
        const priceToSellOnB_bid = bookB.bids[0][0]; 

        const feeA_taker = currentSettings.exchangeFees[exchangeA]?.taker ?? 0.001;
        const feeB_taker = currentSettings.exchangeFees[exchangeB]?.taker ?? 0.001;
        
        // Buy on Exchange A (use Ask price)
        const costPerUnitOnA = priceToBuyOnA_ask * (1 + feeA_taker);
        // Sell on Exchange B (use Bid price)
        const revenuePerUnitOnB = priceToSellOnB_bid * (1 - feeB_taker);
        
        const amountOfAsset = currentSettings.defaultTradeVolumeUSD / costPerUnitOnA; // Amount of asset we can buy
        const totalNetworkFeeForTrade = networkFee; 

        const totalInvestment = currentSettings.defaultTradeVolumeUSD; // Initial USD investment
        const totalRevenueFromSale = amountOfAsset * revenuePerUnitOnB; // Total USD received from sale
        
        const profitInQuoteCurrency = totalRevenueFromSale - totalInvestment - totalNetworkFeeForTrade;
        const profitPercentage = (profitInQuoteCurrency / totalInvestment) * 100; 
        
        if (profitPercentage > currentSettings.minSpreadPercent) {
          const opportunity: TwoLegArbitrageOpportunity = {
            id: uuidv4(),
            type: "2-leg",
            timestamp: new Date().toISOString(),
            currencyPair: pair,
            buyExchange: exchangeA,
            sellExchange: exchangeB,
            buyPrice: priceToBuyOnA_ask, // Buying at Ask
            sellPrice: priceToSellOnB_bid, // Selling at Bid
            profitPercentage: parseFloat(profitPercentage.toFixed(3)),
            potentialProfitUSD: parseFloat(profitInQuoteCurrency.toFixed(2)),
            tradeVolumeUSD: currentSettings.defaultTradeVolumeUSD,
            networkFeeUSD: totalNetworkFeeForTrade,
            buyFeePercentage: feeA_taker * 100,
            sellFeePercentage: feeB_taker * 100,
            details: `Buy ${assetToTransfer} on ${exchangeA} @ ${priceToBuyOnA_ask.toFixed(4)}, Sell on ${exchangeB} @ ${priceToSellOnB_bid.toFixed(4)}. Fees: buy ${feeA_taker*100}%, sell ${feeB_taker*100}%, net ${networkFee}$`,
          };
          opportunities.push(opportunity);
          logs.push(`Found 2-leg: ${exchangeA} -> ${exchangeB} for ${pair}, Profit: ${profitPercentage.toFixed(2)}% ($${profitInQuoteCurrency.toFixed(2)})`);
        }
      }
    }
  }

  const threeLegPairs = ["BTC/USDT", "ETH/BTC", "ETH/USDT"];
  const canAttemptThreeLeg = threeLegPairs.every(p => currentSettings.trackedPairs.includes(p)) && exchangesToScan.length > 0;

  if (canAttemptThreeLeg) {
    const primaryExchange = exchangesToScan[0]; 
    const takerFee = currentSettings.exchangeFees[primaryExchange]?.taker ?? 0.001;
    logs.push(`Scanning for triangular arbitrage on ${primaryExchange} (Taker fee: ${takerFee*100}%) using USDT -> BTC -> ETH -> USDT`);

    const price_BTC_USDT_ask = simulateOrderBook("BTC/USDT", primaryExchange).asks[0][0];
    const price_ETH_BTC_ask = simulateOrderBook("ETH/BTC", primaryExchange).asks[0][0];
    const price_ETH_USDT_bid = simulateOrderBook("ETH/USDT", primaryExchange).bids[0][0];
    
    let S_usd_initial = currentSettings.defaultTradeVolumeUSD;
    
    // Leg 1: Buy BTC with USDT (USDT -> BTC)
    const amount_BTC_bought = (S_usd_initial / price_BTC_USDT_ask) * (1 - takerFee);
    logs.push(`  Leg 1 (USDT->BTC): Spend ${S_usd_initial.toFixed(2)} USDT to get ${amount_BTC_bought.toFixed(8)} BTC @ ${price_BTC_USDT_ask.toFixed(2)} (fee: ${takerFee*100}%)`);

    // Leg 2: Buy ETH with BTC (BTC -> ETH)
    const amount_ETH_bought = (amount_BTC_bought / price_ETH_BTC_ask) * (1 - takerFee);
    logs.push(`  Leg 2 (BTC->ETH): Spend ${amount_BTC_bought.toFixed(8)} BTC to get ${amount_ETH_bought.toFixed(8)} ETH @ ${price_ETH_BTC_ask.toFixed(5)} (fee: ${takerFee*100}%)`);

    // Leg 3: Sell ETH for USDT (ETH -> USDT)
    const S_usd_final = (amount_ETH_bought * price_ETH_USDT_bid) * (1 - takerFee);
    logs.push(`  Leg 3 (ETH->USDT): Sell ${amount_ETH_bought.toFixed(8)} ETH to get ${S_usd_final.toFixed(2)} USDT @ ${price_ETH_USDT_bid.toFixed(2)} (fee: ${takerFee*100}%)`);

    const profit_USD = S_usd_final - S_usd_initial;
    const profit_percentage = (profit_USD / S_usd_initial) * 100;

    if (profit_percentage > currentSettings.minSpreadPercent) {
      const opportunity: ThreeLegArbitrageOpportunity = {
        id: uuidv4(),
        type: "3-leg",
        timestamp: new Date().toISOString(),
        exchange: primaryExchange,
        currencyPair: "USDT -> BTC -> ETH -> USDT", 
        profitPercentage: parseFloat(profit_percentage.toFixed(3)),
        potentialProfitUSD: parseFloat(profit_USD.toFixed(2)),
        tradeVolumeUSD: currentSettings.defaultTradeVolumeUSD,
        legs: [
          { pair: "BTC/USDT", action: "buy", price: price_BTC_USDT_ask, asset: "BTC", feeApplied: takerFee },
          { pair: "ETH/BTC", action: "buy", price: price_ETH_BTC_ask, asset: "ETH", feeApplied: takerFee },
          { pair: "ETH/USDT", action: "sell", price: price_ETH_USDT_bid, asset: "USDT", feeApplied: takerFee },
        ],
        intermediateAssets: ["BTC", "ETH"],
        details: `Triangular on ${primaryExchange}: USDT -> BTC -> ETH -> USDT. Fees included.`,
      };
      opportunities.push(opportunity);
      logs.push(`Found 3-leg: USDT->BTC->ETH->USDT on ${primaryExchange}, Profit: ${profit_percentage.toFixed(2)}% ($${profit_USD.toFixed(2)})`);
    } else {
        logs.push(`No 3-leg found on ${primaryExchange}. Simulated profit: ${profit_percentage.toFixed(3)}%`);
    }
  }
  
  if (opportunities.length === 0) {
      logs.push("No significant arbitrage opportunities found in this simulation run.");
  }

  logger.info(`[ArbitrageActions] Simulation complete. Found ${opportunities.length} opportunities for user ${userId}.`);
  return { opportunities, logs, settings: currentSettings };
}