/**
 * Упрощённый API route: возвращает mock цен или реальные, если есть RPC
 *
 * Для production хочешь использовать on-chain sqrtPriceX96 (Uniswap V3) или внешние API.
 * Здесь — возвращаем мид-прайс TON/ETH и ETH/USD stub.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // MVP stubs:
  const prices = {
    'TON/ETH': { midPrice: 0.02, bid: 0.0198, ask: 0.0202, source: 'stub' },
    'ETH/USD': { midPrice: 1800, bid: 1798, ask: 1802, source: 'stub' },
  };
  return NextResponse.json({ success: true, prices });
}