import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/hooks/supabase';
import crypto from 'crypto';
import axios from 'axios';

// Environment variables are set in Vercel
const BYBIT_API_KEY = process.env.BYBIT_API_KEY!;
const BYBIT_API_SECRET = process.env.BYBIT_API_SECRET!;
const BINANCE_API_KEY = process.env.BINANCE_API_KEY!;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET!;

const SYMBOLS_TO_MONITOR = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

interface MarketData {
  exchange: string;
  symbol: string;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  timestamp: string;
}

// Handler for GET requests, making it easy to trigger via cron or URL
export async function GET(req: NextRequest) {
  try {
    const [binanceData, bybitData] = await Promise.all([
      fetchBinanceData(),
      fetchBybitData()
    ]);

    const allMarketData = [...binanceData, ...bybitData].filter(d => d); // Filter out any null/undefined entries

    if (allMarketData.length === 0) {
        return NextResponse.json({ success: true, count: 0, message: 'No data fetched from exchanges.' });
    }

    const { data, error } = await supabaseAdmin
      .from('market_data')
      .insert(allMarketData);
    
    if (error) {
      console.error('Error inserting into Supabase:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      count: allMarketData.length,
      message: 'Data successfully fetched and stored'
    });
  } catch (error) {
    console.error('Error in fetch-crypto-prices:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

async function fetchBinanceData(): Promise<MarketData[]> {
  const timestamp = Date.now();
  const recvWindow = 5000;
  const results: MarketData[] = [];
  
  for (const symbol of SYMBOLS_TO_MONITOR) {
    try {
        // Binance API signature is optional for these public endpoints
        const [tickerRes, volumeRes] = await Promise.all([
            axios.get(`https://api.binance.com/api/v3/ticker/bookTicker`, { params: { symbol } }),
            axios.get(`https://api.binance.com/api/v3/ticker/24hr`, { params: { symbol } })
        ]);

        results.push({
          exchange: 'binance',
          symbol,
          bid_price: parseFloat(tickerRes.data.bidPrice),
          ask_price: parseFloat(tickerRes.data.askPrice),
          last_price: parseFloat(volumeRes.data.lastPrice),
          volume: parseFloat(volumeRes.data.volume),
          timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error(`Failed to fetch Binance data for ${symbol}`, e);
    }
  }
  return results;
}

async function fetchBybitData(): Promise<MarketData[]> {
  const results: MarketData[] = [];
  
  for (const symbol of SYMBOLS_TO_MONITOR) {
    try {
        // Bybit public endpoint for tickers doesn't require signature
        const response = await axios.get(`https://api.bybit.com/v5/market/tickers`, {
          params: { category: 'spot', symbol }
        });
        
        const ticker = response.data.result.list.find((item: any) => item.symbol === symbol);
        
        if (ticker) {
          results.push({
            exchange: 'bybit',
            symbol,
            bid_price: parseFloat(ticker.bid1Price),
            ask_price: parseFloat(ticker.ask1Price),
            last_price: parseFloat(ticker.lastPrice),
            volume: parseFloat(ticker.volume24h),
            timestamp: new Date().toISOString()
          });
        }
    } catch(e) {
        console.error(`Failed to fetch Bybit data for ${symbol}`, e);
    }
  }
  return results;
}