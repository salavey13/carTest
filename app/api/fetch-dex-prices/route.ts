import { NextResponse, NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { supabaseAdmin } from '@/hooks/supabase';
import { Pool, Route } from '@uniswap/v3-sdk';
import { CurrencyAmount, TradeType, Token } from '@uniswap/sdk-core';
import { JSBI } from '@uniswap/sdk';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import IUniswapV3FactoryABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';

const PROVIDER_URL = process.env.NEXT_PUBLIC_INFURA_URL || 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY';
const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);

const UNISWAP_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984'; // Uniswap V3 Factory
const SUSHI_FACTORY_ADDRESS = '0xc35DADB65012eC5796536bD9864eD8773aBc74C4'; // SushiSwap Factory (same as Uniswap V2 style, but for V3 adapt)

const DEFAULT_PAIRS = [
  { base: 'ETH', quote: 'USDT', addressBase: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', addressQuote: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimalsBase: 18, decimalsQuote: 6 },
  { base: 'BTC', quote: 'USDT', addressBase: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', addressQuote: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimalsBase: 8, decimalsQuote: 6 },
  // Add more
];

const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

interface MarketData {
  exchange: string;
  symbol: string;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  timestamp: string;
}

export async function GET(req: NextRequest) {
  try {
    const allMarketData: MarketData[] = [];

    for (const pair of DEFAULT_PAIRS) {
      const uniswapData = await fetchDexData(pair, 'uniswap', UNISWAP_FACTORY_ADDRESS);
      const sushiData = await fetchDexData(pair, 'sushiswap', SUSHI_FACTORY_ADDRESS); // Adapt for Sushi V3 if needed
      if (uniswapData) allMarketData.push(uniswapData);
      if (sushiData) allMarketData.push(sushiData);
    }

    if (allMarketData.length > 0) {
      const { error } = await supabaseAdmin.from('market_data').insert(allMarketData);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, count: allMarketData.length });
  } catch (error) {
    console.error('Error fetching DEX prices:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

async function fetchDexData(pair: any, exchange: string, factoryAddress: string): Promise<MarketData | null> {
  try {
    const factory = new ethers.Contract(factoryAddress, IUniswapV3FactoryABI.abi, provider);

    let poolAddress = '';
    for (const fee of FEE_TIERS) {
      poolAddress = await factory.getPool(pair.addressBase, pair.addressQuote, fee);
      if (poolAddress !== ethers.constants.AddressZero) break;
    }

    if (poolAddress === ethers.constants.AddressZero) return null;

    const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI.abi, provider);
    const [slot0, liquidity] = await Promise.all([poolContract.slot0(), poolContract.liquidity()]);

    const tokenBase = new Token(1, pair.addressBase, pair.decimalsBase);
    const tokenQuote = new Token(1, pair.addressQuote, pair.decimalsQuote);

    const pool = new Pool(
      tokenBase,
      tokenQuote,
      FEE_TIERS[0], // Assume first found
      slot0.sqrtPriceX96.toString(),
      liquidity.toString(),
      slot0.tick
    );

    // Simulate prices: mid price as last, bid/ask as slight offsets
    const midPrice = parseFloat(pool.token0Price.toSignificant(6));
    const volume = parseFloat(liquidity.toString()) / 1e18; // Approximate

    return {
      exchange,
      symbol: `${pair.base}/${pair.quote}`,
      bid_price: midPrice * 0.999,
      ask_price: midPrice * 1.001,
      last_price: midPrice,
      volume,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error(`Failed to fetch ${exchange} data for ${pair.base}/${pair.quote}`, e);
    return null;
  }
}