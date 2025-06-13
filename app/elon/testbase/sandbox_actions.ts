"use server";

import { logger } from "@/lib/logger";
import {
  ArbitrageOpportunity,
  TwoLegArbitrageOpportunity,
  ThreeLegArbitrageOpportunity,
  ExchangeName,
  ArbitrageSettings,
  ALL_POSSIBLE_EXCHANGES_CONST,
  DEFAULT_ARBITRAGE_SETTINGS as SANDBOX_DEFAULT_SETTINGS, // Using a distinct default or the same one
} from "@/app/elon/arbitrage_scanner_types"; // Adjusted path
import { v4 as uuidv4 } from 'uuid';

// simulateOrderBook is assumed to be defined here or imported if it's in a shared util
// For this example, let's copy it here for self-containment of this sandbox action file.
// In a real scenario, you'd likely import it from wherever it's defined in elon/arbitrage_scanner_actions.ts
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


export async function fetchArbitrageOpportunitiesWithSettings(
  settings: ArbitrageSettings,
): Promise<{
  opportunities: ArbitrageOpportunity[];
  logs: string[];
  settingsUsed: ArbitrageSettings;
}> {
  const currentSettings = { ...SANDBOX_DEFAULT_SETTINGS, ...settings };
  const userIdForLog = "sandbox_user_viz_test";

  logger.info(`[SandboxActions] Simulating arbitrage scan for ${userIdForLog} with provided settings:`, currentSettings);
  const logs: string[] = [];
  const opportunities: ArbitrageOpportunity[] = [];

  logs.push(`SANDBOX SCAN (SETTINGS OVERRIDE):`);
  logs.push(`Min Spread: ${currentSettings.minSpreadPercent}%, Trade Volume: $${currentSettings.defaultTradeVolumeUSD}`);
  logs.push(`Enabled Exchanges: ${currentSettings.enabledExchanges.join(', ') || 'None'}`);
  logs.push(`Tracked Pairs: ${currentSettings.trackedPairs.join(', ') || 'None'}`);

  if (currentSettings.enabledExchanges.length < 2 && currentSettings.trackedPairs.some(p => !p.includes("->"))) { // Check for 2-leg needs
      logs.push("Warning: At least two exchanges must be enabled for 2-leg arbitrage simulation if non-triangular pairs are tracked.");
  }

  const exchangesToScan = currentSettings.enabledExchanges.length > 0 ? currentSettings.enabledExchanges : ALL_POSSIBLE_EXCHANGES_CONST;

  // Simulate 2-leg opportunities
  for (const pair of currentSettings.trackedPairs) {
    if (pair.includes("->")) continue; // Skip triangular definitions for 2-leg
    if (exchangesToScan.length < 2) continue;

    const assetToTransfer = pair.split('/')[0];
    let networkFeeKey = assetToTransfer; // Default key
    if (Object.prototype.hasOwnProperty.call(currentSettings.networkFees, assetToTransfer + "_ERC20")) {
        networkFeeKey = assetToTransfer + "_ERC20";
    } else if (Object.prototype.hasOwnProperty.call(currentSettings.networkFees, assetToTransfer + "_TRC20")) {
        networkFeeKey = assetToTransfer + "_TRC20";
    }
    
    const networkFee = Object.prototype.hasOwnProperty.call(currentSettings.networkFees, networkFeeKey)
                        ? currentSettings.networkFees[networkFeeKey] ?? 1
                        : 1;

    for (let i = 0; i < exchangesToScan.length; i++) {
      for (let j = 0; j < exchangesToScan.length; j++) {
        if (i === j) continue;

        const exchangeA = exchangesToScan[i];
        const exchangeB = exchangesToScan[j];

        const bookA = simulateOrderBook(pair, exchangeA);
        const bookB = simulateOrderBook(pair, exchangeB);

        const priceToBuyOnA_ask = bookA.asks[0][0];
        const priceToSellOnB_bid = bookB.bids[0][0];

        const feeA_taker = currentSettings.exchangeFees[exchangeA]?.taker ?? 0.001;
        const feeB_taker = currentSettings.exchangeFees[exchangeB]?.taker ?? 0.001;

        const costPerUnitOnA = priceToBuyOnA_ask * (1 + feeA_taker);
        const revenuePerUnitOnB = priceToSellOnB_bid * (1 - feeB_taker);

        const amountOfAsset = currentSettings.defaultTradeVolumeUSD / costPerUnitOnA;
        const totalNetworkFeeForTrade = networkFee;

        const totalInvestment = currentSettings.defaultTradeVolumeUSD;
        const totalRevenueFromSale = amountOfAsset * revenuePerUnitOnB;

        const profitInQuoteCurrency = totalRevenueFromSale - totalInvestment - totalNetworkFeeForTrade;
        const profitPercentage = (profitInQuoteCurrency / totalInvestment) * 100;

        if (profitPercentage >= currentSettings.minSpreadPercent) { // Use >= for inclusivity
          const opportunity: TwoLegArbitrageOpportunity = {
            id: uuidv4(),
            type: "2-leg",
            timestamp: new Date().toISOString(),
            currencyPair: pair,
            buyExchange: exchangeA,
            sellExchange: exchangeB,
            buyPrice: priceToBuyOnA_ask,
            sellPrice: priceToSellOnB_bid,
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

  const threeLegPairsDefinition = ["BTC/USDT", "ETH/BTC", "ETH/USDT"]; // The pairs needed for the specific triangular route
  const canAttemptThreeLeg = threeLegPairsDefinition.every(p => currentSettings.trackedPairs.includes(p)) && exchangesToScan.length > 0;

  if (canAttemptThreeLeg) {
    const primaryExchange = exchangesToScan[0];
    const takerFee = currentSettings.exchangeFees[primaryExchange]?.taker ?? 0.001;
    const triangularRouteDisplay = "USDT->BTC->ETH->USDT";
    logs.push(`Scanning for triangular arbitrage on ${primaryExchange} (Taker fee: ${takerFee*100}%) using ${triangularRouteDisplay}`);

    const price_BTC_USDT_ask = simulateOrderBook("BTC/USDT", primaryExchange).asks[0][0];
    const price_ETH_BTC_ask = simulateOrderBook("ETH/BTC", primaryExchange).asks[0][0];
    const price_ETH_USDT_bid = simulateOrderBook("ETH/USDT", primaryExchange).bids[0][0];

    let S_usd_initial = currentSettings.defaultTradeVolumeUSD;

    const amount_BTC_bought = (S_usd_initial / price_BTC_USDT_ask) * (1 - takerFee);
    // logs.push(`  Leg 1 (USDT->BTC): Spend ${S_usd_initial.toFixed(2)} USDT to get ${amount_BTC_bought.toFixed(8)} BTC @ ${price_BTC_USDT_ask.toFixed(2)} (fee: ${takerFee*100}%)`); // Verbose

    const amount_ETH_bought = (amount_BTC_bought / price_ETH_BTC_ask) * (1 - takerFee);
    // logs.push(`  Leg 2 (BTC->ETH): Spend ${amount_BTC_bought.toFixed(8)} BTC to get ${amount_ETH_bought.toFixed(8)} ETH @ ${price_ETH_BTC_ask.toFixed(5)} (fee: ${takerFee*100}%)`); // Verbose

    const S_usd_final = (amount_ETH_bought * price_ETH_USDT_bid) * (1 - takerFee);
    // logs.push(`  Leg 3 (ETH->USDT): Sell ${amount_ETH_bought.toFixed(8)} ETH to get ${S_usd_final.toFixed(2)} USDT @ ${price_ETH_USDT_bid.toFixed(2)} (fee: ${takerFee*100}%)`); // Verbose

    const profit_USD = S_usd_final - S_usd_initial;
    const profit_percentage = (profit_USD / S_usd_initial) * 100;

    if (profit_percentage >= currentSettings.minSpreadPercent) { // Use >= for inclusivity
      const opportunity: ThreeLegArbitrageOpportunity = {
        id: uuidv4(),
        type: "3-leg",
        timestamp: new Date().toISOString(),
        exchange: primaryExchange,
        currencyPair: triangularRouteDisplay,
        profitPercentage: parseFloat(profit_percentage.toFixed(3)),
        potentialProfitUSD: parseFloat(profit_USD.toFixed(2)),
        tradeVolumeUSD: currentSettings.defaultTradeVolumeUSD,
        legs: [
          { pair: "BTC/USDT", action: "buy", price: price_BTC_USDT_ask, asset: "BTC", feeApplied: takerFee },
          { pair: "ETH/BTC", action: "buy", price: price_ETH_BTC_ask, asset: "ETH", feeApplied: takerFee },
          { pair: "ETH/USDT", action: "sell", price: price_ETH_USDT_bid, asset: "USDT", feeApplied: takerFee },
        ],
        intermediateAssets: ["BTC", "ETH"],
        details: `Triangular on ${primaryExchange}: ${triangularRouteDisplay}. Fees included.`,
      };
      opportunities.push(opportunity);
      logs.push(`Found 3-leg: ${triangularRouteDisplay} on ${primaryExchange}, Profit: ${profit_percentage.toFixed(2)}% ($${profit_USD.toFixed(2)})`);
    } else {
        logs.push(`No profitable 3-leg found on ${primaryExchange} for ${triangularRouteDisplay}. Simulated profit: ${profit_percentage.toFixed(3)}%`);
    }
  }

  if (opportunities.length === 0) {
      logs.push("No significant arbitrage opportunities found in this sandbox simulation run.");
  }

  logger.info(`[SandboxActions] Simulation complete. Found ${opportunities.length} opportunities for ${userIdForLog}.`);
  return { opportunities, logs, settingsUsed: currentSettings };
}