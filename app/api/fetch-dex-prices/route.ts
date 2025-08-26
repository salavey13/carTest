import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const FEE_TIERS = [500, 3000, 10000];

const DEFAULT_PAIRS = [
  {
    base: 'ETH',
    quote: 'USDC',
    addressBase: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    addressQuote: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimalsBase: 18,
    decimalsQuote: 6,
  },
  {
    base: 'TON',
    quote: 'WETH',
    addressBase: '0xTON000000000000000000000000000000000000',
    addressQuote: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimalsBase: 9,
    decimalsQuote: 18,
  },
];

const FACTORY_ABI = ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'];
const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function liquidity() external view returns (uint128)',
];

function bigIntToDecimalString(n: bigint, precision = 18) {
  const TEN = 10n;
  const scale = TEN ** BigInt(precision);
  const integerPart = n / scale;
  const fracPart = n % scale;
  const fracStr = fracPart.toString().padStart(precision, '0').replace(/0+$/, '');
  return fracStr.length > 0 ? `${integerPart.toString()}.${fracStr}` : integerPart.toString();
}

export async function GET() {
  try {
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
        }
      }

      if (!foundPoolAddress || foundPoolAddress === ethers.constants.AddressZero) {
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
      const [slot0, token0Addr, token1Addr] = await Promise.all([
        pool.slot0(),
        pool.token0(),
        pool.token1(),
      ]);

      const sqrtPriceX96 = slot0[0];
      const sqrtBig = BigInt(sqrtPriceX96.toString());
      const numerator = sqrtBig * sqrtBig;
      const denom = 1n << 192n;
      const scaled = (numerator * 10n ** 18n) / denom;
      const midPriceStr = bigIntToDecimalString(scaled, 18);
      const midPriceFloat = parseFloat(midPriceStr);

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
        last_price: midPriceFloat,
        bid_price: bid,
        ask_price: ask,
        volume: 0,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, markets: results });
  } catch (err: any) {
    console.error('fetch-dex-prices error', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}