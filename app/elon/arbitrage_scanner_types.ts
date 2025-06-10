export type ExchangeName = "Binance" | "Bybit" | "KuCoin" | "Gate.io" | "OKX" | "SimulatedExchangeA" | "SimulatedExchangeB";

export interface ArbitrageOpportunityBase {
  id: string;
  timestamp: string;
  profitPercentage: number;
  potentialProfitUSD: number; 
  tradeVolumeUSD: number;
  currencyPair: string; 
}

export interface TwoLegArbitrageOpportunity extends ArbitrageOpportunityBase {
  type: "2-leg";
  buyExchange: ExchangeName;
  sellExchange: ExchangeName;
  buyPrice: number;
  sellPrice: number;
  networkFeeUSD: number;
  buyFeePercentage: number; // Taker fee for buying on buyExchange
  sellFeePercentage: number; // Taker fee for selling on sellExchange
  details: string; 
}

export interface ThreeLegArbitrageOpportunity extends ArbitrageOpportunityBase {
  type: "3-leg";
  exchange: ExchangeName;
  legs: [
    { pair: string; action: "buy" | "sell"; price: number; asset: string; feeApplied: number; },
    { pair: string; action: "buy" | "sell"; price: number; asset: string; feeApplied: number; },
    { pair: string; action: "buy" | "sell"; price: number; asset: string; feeApplied: number; }
  ];
  intermediateAssets: [string, string]; 
  details: string; 
}

export type ArbitrageOpportunity = TwoLegArbitrageOpportunity | ThreeLegArbitrageOpportunity;

export interface ArbitrageSettings {
  minSpreadPercent: number; 
  enabledExchanges: ExchangeName[];
  trackedPairs: string[]; 
  defaultTradeVolumeUSD: number;
  exchangeFees: Partial<Record<ExchangeName, { maker: number; taker: number }>>;
  networkFees: Partial<Record<string, number>>; 
}

export const ALL_POSSIBLE_EXCHANGES_CONST: ExchangeName[] = ["Binance", "Bybit", "KuCoin", "Gate.io", "OKX", "SimulatedExchangeA", "SimulatedExchangeB"];
export const DEFAULT_TRACKED_ASSETS_FOR_NETWORK_FEES: string[] = ["BTC", "ETH", "SOL", "USDT_ERC20", "USDT_TRC20"];


const defaultExchangeFees: Partial<Record<ExchangeName, { maker: number; taker: number }>> = {};
ALL_POSSIBLE_EXCHANGES_CONST.forEach(ex => {
    defaultExchangeFees[ex] = { maker: 0.001, taker: 0.001 }; 
});

const defaultNetworkFees: Partial<Record<string, number>> = {};
DEFAULT_TRACKED_ASSETS_FOR_NETWORK_FEES.forEach(asset => {
    if (asset === "BTC") defaultNetworkFees[asset] = 5;       
    else if (asset === "ETH") defaultNetworkFees[asset] = 2;  
    else if (asset === "SOL") defaultNetworkFees[asset] = 0.1; 
    else if (asset === "USDT_ERC20") defaultNetworkFees[asset] = 3; 
    else if (asset === "USDT_TRC20") defaultNetworkFees[asset] = 1; 
    else defaultNetworkFees[asset] = 1; 
});


export const DEFAULT_ARBITRAGE_SETTINGS: ArbitrageSettings = { 
  minSpreadPercent: 0.5,
  enabledExchanges: ["Binance", "Bybit", "KuCoin"],
  trackedPairs: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "ETH/BTC"],
  defaultTradeVolumeUSD: 1000,
  exchangeFees: defaultExchangeFees,
  networkFees: defaultNetworkFees,
};