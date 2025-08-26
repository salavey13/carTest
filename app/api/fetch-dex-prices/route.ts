/**
 * /app/api/fetch-dex-prices/route.ts
 *
 * Real Uniswap V3 price lookup:
 * - reads UniswapV3 factory -> pool (fee tiers) -> pool.slot0()
 * - reads token0/token1 and token decimals (via ERC20.decimals())
 * - computes human mid price = token1 per 1 token0 (adjusting for decimals)
 *
 * Requires env: NEXT_PUBLIC_RPC_URL (Infura/Alchemy/etc)
 *
 * Note: uses ethers v6 style (ethers.JsonRpcProvider). If your project pins ethers@5,
 * adapt provider/contract creation accordingly.
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";

const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const FEE_TIERS = [500, 3000, 10000]; // in hundredths of bps: 0.05%, 0.3%, 1%

// Default pairs to check — adjust addresses/decimals to your needs
const DEFAULT_PAIRS = [
  {
    base: "ETH",
    quote: "USDC",
    addressBase: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    addressQuote: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    decimalsBase: 18,
    decimalsQuote: 6,
  },
  {
    base: "TON",
    quote: "WETH",
    addressBase: "0xTON000000000000000000000000000000000000", // placeholder - replace with real TON ERC20 if available
    addressQuote: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    decimalsBase: 9,
    decimalsQuote: 18,
  },
];

// ABIs (minimal)
const FACTORY_ABI = ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"];
const POOL_ABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function liquidity() external view returns (uint128)",
];
// minimal ERC20 ABI for decimals()
const ERC20_ABI = ["function decimals() external view returns (uint8)", "function symbol() external view returns (string)"];

/**
 * helper: convert BigInt to decimal string with precision places (like "123.456")
 */
function bigIntToDecimalString(n: bigint, precision = 18) {
  const TEN = 10n;
  const scale = TEN ** BigInt(precision);
  const integerPart = n / scale;
  const fracPart = n % scale;
  let fracStr = fracPart.toString().padStart(precision, "0");
  // trim trailing zeros
  fracStr = fracStr.replace(/0+$/, "");
  return fracStr.length > 0 ? `${integerPart.toString()}.${fracStr}` : integerPart.toString();
}

export async function GET() {
  try {
    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
    if (!RPC_URL) {
      return NextResponse.json({ success: false, error: "Missing RPC URL in env (NEXT_PUBLIC_RPC_URL)" }, { status: 500 });
    }

    // ethers v6 provider (if you use ethers@5, change to new ethers.providers.JsonRpcProvider)
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);

    const results: any[] = [];

    for (const pair of DEFAULT_PAIRS) {
      let poolAddr = ethers.ZeroAddress;
      let usedFee = 0;

      for (const fee of FEE_TIERS) {
        try {
          // getPool may throw or return zero address
          const candidate = await factory.getPool(pair.addressBase, pair.addressQuote, fee);
          if (candidate && candidate !== ethers.ZeroAddress) {
            poolAddr = candidate;
            usedFee = fee;
            break;
          }
        } catch (e) {
          // ignore and try next fee tier
        }
      }

      if (!poolAddr || poolAddr === ethers.ZeroAddress) {
        results.push({
          exchange: "uniswap-v3",
          symbol: `${pair.base}/${pair.quote}`,
          pool: null,
          found: false,
          info: `no pool found for fees ${FEE_TIERS.join(",")}`,
        });
        continue;
      }

      // instantiate pool contract
      const pool = new ethers.Contract(poolAddr, POOL_ABI, provider);

      // read slot0, token0, token1
      const [slot0, token0Addr, token1Addr] = await Promise.all([pool.slot0(), pool.token0(), pool.token1()]);

      // sqrtPriceX96 is slot0[0]
      const sqrtPriceX96Raw = slot0[0];
      const sqrtBig = BigInt(sqrtPriceX96Raw.toString());

      // get decimals for token0/token1 via ERC20.decimals() (try/catch; fall back to DEFAULT_PAIRS decimals)
      let decimals0 = pair.decimalsBase;
      let decimals1 = pair.decimalsQuote;
      let symbol0 = "T0";
      let symbol1 = "T1";

      try {
        const t0 = new ethers.Contract(token0Addr, ERC20_ABI, provider);
        const t1 = new ethers.Contract(token1Addr, ERC20_ABI, provider);
        const [d0, d1, s0, s1] = await Promise.all([
          t0.decimals().catch(() => pair.decimalsBase),
          t1.decimals().catch(() => pair.decimalsQuote),
          t0.symbol().catch(() => pair.base),
          t1.symbol().catch(() => pair.quote),
        ]);
        decimals0 = Number(d0);
        decimals1 = Number(d1);
        symbol0 = String(s0);
        symbol1 = String(s1);
      } catch (e) {
        // ignore and use defaults from pair entry
      }

      // raw_ratio = (sqrtPriceX96^2) / 2^192  (this is token1_raw / token0_raw)
      const numerator = sqrtBig * sqrtBig; // sqrtPriceX96^2
      const denom = 1n << 192n; // 2^192

      // We want human price: token1_per_1_token0
      // humanPrice = raw_ratio * 10^(decimals0 - decimals1)
      // To produce string with 'precision' decimal places, scale numerator accordingly:
      const PRECISION = 18; // scale to 18 decimals for string accuracy
      const decimalsAdjustment = BigInt(decimals0 - decimals1); // can be negative
      // compute scaled = (numerator * 10^(PRECISION + decimals0 - decimals1)) / denom
      const scaleFactorPower = PRECISION + Number(decimals0 - decimals1);
      let scaled: bigint;
      if (scaleFactorPower >= 0) {
        scaled = (numerator * (10n ** BigInt(scaleFactorPower))) / denom;
      } else {
        // negative scale: divide extra
        const divFactor = 10n ** BigInt(-scaleFactorPower);
        scaled = (numerator / divFactor) / denom;
      }

      const midPriceStr = bigIntToDecimalString(scaled, PRECISION);
      const midPriceFloat = parseFloat(midPriceStr);

      // create tiny bid/ask spread (0.05%)
      const bid = midPriceFloat * 0.9995;
      const ask = midPriceFloat * 1.0005;

      results.push({
        exchange: "uniswap-v3",
        symbol: `${pair.base}/${pair.quote}`,
        pool: poolAddr,
        fee: usedFee,
        token0: token0Addr,
        token1: token1Addr,
        token0_symbol: symbol0,
        token1_symbol: symbol1,
        token0_decimals: decimals0,
        token1_decimals: decimals1,
        sqrtPriceX96: sqrtPriceX96Raw.toString(),
        midPriceStr, // precise-ish string scaled to PRECISION
        last_price: midPriceFloat,
        bid_price: bid,
        ask_price: ask,
        volume: 0,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, markets: results });
  } catch (err: any) {
    console.error("fetch-dex-prices error", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}