import { NextRequest, NextResponse } from 'next/server';
import { BigNumber } from 'ethers';
import { calcFee, decimalsToWei } from '@/lib/utils';
import { Token } from '@/lib/core';

/**
 * Body expected:
 * {
 *  loanToken: { chainId, address, decimals, symbol },
 *  loanAmount: string (human amount, e.g. "5"),
 *  // price info provided by client (from /api/fetch-dex-prices): midPrice = base/quote (e.g. TON/ETH)
 *  midPrice: number,
 *  // estimate gas in ETH (e.g. 0.003)
 *  gasEstimateETH?: number,
 *  ethPriceInLoanToken?: number // convert gas to loan token units (optional)
 * }
 *
 * Returns:
 * {
 *   loanWei, feeWei, repayWei, gasCostInLoanToken, profitIfSwapAll: number, profitable: bool, plan: RouterLogic[]
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      loanToken,
      loanAmount,
      midPrice,
      gasEstimateETH = 0.003,
      ethPriceInLoanToken // optional: convert gas cost to loan token units
    } = body;

    // minimal validations
    if (!loanToken || !loanAmount || !midPrice) {
      return NextResponse.json({ success: false, error: 'missing params' }, { status: 400 });
    }

    // assume Aave feeBps = 9 (0.09%)
    const feeBps = 9;

    // convert loanAmount to wei string using decimals
    const loanWei = decimalsToWei(String(loanAmount), loanToken.decimals);

    // calc fee
    const feeWei = calcFee(loanWei, feeBps, 'round');

    // repay = loan + fee
    const repayWei = BigNumber.from(loanWei).add(BigNumber.from(feeWei)).toString();

    // estimate gas cost in loanToken units: gasEstimateETH * midPrice (if midPrice expresses ETH per loanToken or vice-versa)
    // Here we expect midPrice = 1 loanToken = X ETH (client must provide ratio ETH per loanToken). To avoid ambiguity, client sends ethPriceInLoanToken if available.
    let gasCostInLoanToken = 0;
    if (ethPriceInLoanToken) {
      gasCostInLoanToken = Number(gasEstimateETH) / Number(ethPriceInLoanToken);
    } else {
      // fallback: use midPrice as loanToken per ETH? If midPrice expresses loanToken/ETH, interpret accordingly.
      // let's assume midPrice = loanToken per ETH (i.e., 1 ETH = midPrice loanToken)
      gasCostInLoanToken = gasEstimateETH * (midPrice || 1);
    }

    // crude swap scenario: if we borrowed loanToken and swap to another asset to profit, we need expected output.
    // client may provide expected output estimate (from getPrices). For simplicity assume a representative spread of 1% profit (client uses DEX prices)
    const assumedProfitRatio = body.assumedProfitRatio ?? 0.01; // 1% default
    // profit if we swapped entire loan to target and back
    const loanAmountNum = Number(loanAmount);
    const grossProfit = loanAmountNum * assumedProfitRatio;
    const totalCostsLoanToken = Number(ethersFormat(repayWei, loanToken.decimals)) - loanAmountNum + gasCostInLoanToken;
    const netProfit = grossProfit - totalCostsLoanToken;

    const result = {
      success: true,
      loanToken,
      loanAmount,
      loanWei,
      feeWei,
      repayWei,
      feeBps,
      gasEstimateETH,
      gasCostInLoanToken,
      assumedProfitRatio,
      grossProfit,
      totalCostsLoanToken,
      netProfit,
      profitable: netProfit > 0,
      plan: [
        { to: 'AAVE_POOL_ADDRESS', data: 'flashLoan(...)', callback: 'AAVE_CALLBACK' },
        { to: 'DEX_ROUTER', data: 'swap(...)' },
        { to: 'AAVE_POOL_ADDRESS', data: 'repay(...)' },
      ],
    };

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// tiny helper: convert wei string to human
import { ethers } from 'ethers';
function ethersFormat(wei: string, decimals: number) {
  try {
    return Number(ethers.utils.formatUnits(wei, decimals));
  } catch {
    return Number(wei);
  }
}