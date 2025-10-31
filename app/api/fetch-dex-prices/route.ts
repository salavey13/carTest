/**
 * Реальная версия: инспектирует Uniswap V3 factory -> pool -> slot0(),
 * вычисляет midPrice = (sqrtPriceX96^2 / 2^192) и возвращает mid, bid, ask.
 *
 * Подключено для ethers@6:
 * - provider: new ethers.JsonRpcProvider(RPC_URL)
 * - используем ethers.BigInt-friendly операции и ethers.parseUnits/formatUnits
 *
 * Требования:
 * - В .env: NEXT_PUBLIC_RPC_URL (или NEXT_PUBLIC_INFURA_URL)
 */
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// --- Настройки Uniswap V3
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE_TIERS = [500, 3000, 10000];

// Пары — замените адреса на реальные для TON, если есть
const DEFAULT_PAIRS = [
  {
    base: 'TON',
    quote: 'WETH',
    addressBase: '0xTON000000000000000000000000000000000000', // placeholder
    addressQuote: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
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

const FACTORY_ABI = ['function getPool(address,address,uint24) external view returns (address)'];
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function liquidity() external view returns (uint128)',
];

// форматирование BigInt -> строка с дробной частью precision
function bigIntToDecimalString(n: bigint, precision = 18) {
  const TEN = 10n;
  const scale = TEN ** BigInt(precision);
  const integerPart = n / scale;
  const fracPart = n % scale;
  let fracStr = fracPart.toString().padStart(precision, '0');
  // отрезаем хвостовые нули
  fracStr = fracStr.replace(/0+$/, '');
  return fracStr.length > 0 ? `${integerPart.toString()}.${fracStr}` : integerPart.toString();
}

export async function GET() {
  try {
    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_INFURA_URL;
    if (!RPC_URL) {
      return NextResponse.json({ success: false, error: 'Missing RPC URL in env (NEXT_PUBLIC_RPC_URL)' }, { status: 500 });
    }

    // ethers@6 provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);

    const results: any[] = [];
    for (const pair of DEFAULT_PAIRS) {
      let foundPoolAddress = ethers.ZeroAddress || '0x0000000000000000000000000000000000000000';
      let foundFee = 0;
      for (const fee of FEE_TIERS) {
        try {
          // getPool(tokenA, tokenB, fee)
          const poolAddr: string = await factory.getPool(pair.addressBase, pair.addressQuote, fee);
          if (poolAddr && poolAddr !== ethers.ZeroAddress) {
            foundPoolAddress = poolAddr;
            foundFee = fee;
            break;
          }
        } catch (e) {
          // ignore and try next fee
        }
      }

      if (!foundPoolAddress || foundPoolAddress === ethers.ZeroAddress) {
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
      const [slot0, token0Addr, token1Addr] = await Promise.all([pool.slot0(), pool.token0(), pool.token1()]);

      const sqrtPriceX96 = BigInt(slot0[0].toString());
      // midPrice = (sqrtPriceX96^2) / 2^192
      const numerator = sqrtPriceX96 * sqrtPriceX96;
      const denom = 1n << 192n;
      const scaled = (numerator * 10n ** 18n) / denom; // scaled by 1e18
      const midPriceStr = bigIntToDecimalString(scaled, 18);
      const midPriceFloat = Number(midPriceStr); // approximate for quick use

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
        midPriceStr,
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