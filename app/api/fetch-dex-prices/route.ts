/**
 * /app/api/fetch-dex-prices/route.ts
 *
 * Реальная версия: инспектирует Uniswap V3 factory -> pool -> slot0(),
 * вычисляет midPrice = (sqrtPriceX96^2 / 2^192) и возвращает mid, bid, ask.
 *
 * Требования:
 * - Установлен пакет "ethers" (рекомендуется v5.x в Next.js; см. заметки ниже).
 * - В .env добавлен NEXT_PUBLIC_RPC_URL (или NEXT_PUBLIC_INFURA_URL).
 *
 * Ограничения / поведение:
 * - Для каждого pair (из DEFAULT_PAIRS) пробует fee tiers [500,3000,10000] и берёт первый найденный пул.
 * - Возвращает цену как строку (decimal) с 18 знаками точности (midPriceStr) и numeric приближённое midPriceFloat.
 * - Не использует @uniswap SDK, чтобы не тащить тяжёлые зависимости.
 */

import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// --- Настройка: фабрика Uniswap V3 mainnet
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

// Набор пар по умолчанию — поменяй/дополни под нужды
const DEFAULT_PAIRS = [
  {
    base: 'TON',
    quote: 'WETH',
    addressBase: '0xTON000000000000000000000000000000000000', // Замени на реальный TON ERC20 адрес, если есть
    addressQuote: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH mainnet
    decimalsBase: 9,
    decimalsQuote: 18,
  },
  {
    base: 'ETH',
    quote: 'USDC',
    addressBase: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    addressQuote: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimalsBase: 18,
    decimalsQuote: 6,
  },
];

// Minimal ABIs
const FACTORY_ABI = ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'];
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function liquidity() external view returns (uint128)',
];

function bigIntToDecimalString(n: bigint, precision = 18) {
  // возвращает строку вида "123.456..." с точностью precision (кол-во цифр после запятой)
  const TEN = 10n;
  const scale = TEN ** BigInt(precision);
  const integerPart = n / scale;
  const fracPart = n % scale;
  const fracStr = fracPart.toString().padStart(precision, '0').replace(/0+$/, ''); // отрезаем хвостовые нули
  return fracStr.length > 0 ? `${integerPart.toString()}.${fracStr}` : integerPart.toString();
}

export async function GET() {
  try {
    // Provider: сначала NEXT_PUBLIC_RPC_URL, затем NEXT_PUBLIC_INFURA_URL
    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_INFURA_URL;
    if (!RPC_URL) {
      return NextResponse.json({ success: false, error: 'Missing RPC URL in env (NEXT_PUBLIC_RPC_URL)' }, { status: 500 });
    }
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);

    const results: any[] = [];

    for (const pair of DEFAULT_PAIRS) {
      let foundPoolAddress = ethers.constants.AddressZero;
      let foundFee = 0;
      for (const fee of FEE_TIERS) {
        try {
          const poolAddr = await factory.getPool(pair.addressBase, pair.addressQuote, fee);
          if (poolAddr && poolAddr !== ethers.constants.AddressZero) {
            foundPoolAddress = poolAddr;
            foundFee = fee;
            break;
          }
        } catch (e) {
          // игнорируем и пробуем следующий fee
        }
      }

      if (!foundPoolAddress || foundPoolAddress === ethers.constants.AddressZero) {
        // pool not found — отдаём null для этой пары
        results.push({
          exchange: 'uniswap-v3',
          symbol: `${pair.base}/${pair.quote}`,
          pool: null,
          found: false,
          info: `no pool found for fees ${FEE_TIERS.join(',')}`,
        });
        continue;
      }

      const pool = new ethers.Contract(foundPoolAddress, POOL_ABI, provider);
      // вызов slot0 и токенов
      const [slot0, token0Addr, token1Addr] = await Promise.all([
        pool.slot0(),
        pool.token0(),
        pool.token1(),
      ]);

      // slot0[0] == sqrtPriceX96
      const sqrtPriceX96 = slot0[0];
      // вычислим midPrice = (sqrtPriceX96^2) / 2^192
      const sqrtBig = BigInt(sqrtPriceX96.toString());
      const numerator = sqrtBig * sqrtBig; // sqrtPriceX96^2
      const denom = 1n << 192n; // 2^192
      // масштабируем на 1e18 для строковой точности
      const scaled = (numerator * 10n ** 18n) / denom; // BigInt
      const midPriceStr = bigIntToDecimalString(scaled, 18); // строка с 18 знаками
      // parse float для быстрых вычислений (приближ.)
      const midPriceFloat = parseFloat(midPriceStr);

      // создаём bid/ask с небольшим спредом (например 0.05%)
      const bid = midPriceFloat * 0.9995;
      const ask = midPriceFloat * 1.0005;

      results.push({
        exchange: 'uniswap-v3',
        symbol: `${pair.base}/${pair.quote}`,
        pool: foundPoolAddress,
        fee: foundFee,
        token0: token0Addr,
        token1: token1Addr,
        sqrtPriceX96: sqrtPriceX96.toString(),
        midPriceStr, // string precise-ish
        midPriceFloat,
        bid,
        ask,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, markets: results });
  } catch (err: any) {
    console.error('fetch-dex-prices error', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}