import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { calcFee, decimalsToWei } from '@/lib/utils';
import { Token } from '@/lib/core';

/**
 * Lightweight quote endpoint (POC).
 * Переведён на ethers@6 / bigint-based math in utils.
 *
 * Тело запроса ожидается как описано в PR — см. usage в UI.
 */

function ethersFormat(wei: string | bigint, decimals: number) {
  try {
    // ethers.formatUnits accepts bigint or string (v6)
    return Number(ethers.formatUnits(typeof wei === 'string' ? BigInt(wei) : wei, decimals));
  } catch {
    return Number(wei as any);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      loanToken,
      loanAmount,
      midPrice,
      gasEstimateETH = 0.003,
      ethPriceInLoanToken
    } = body;

    if (!loanToken || !loanAmount || !midPrice) {
      return NextResponse.json({ success: false, error: 'missing params' }, { status: 400 });
    }

    // Aave feeBps = 9 (0.09%)
    const feeBps = 9;

    // loanWei — строка целого (wei) через ethers.parseUnits -> bigint -> toString
    const loanWeiStr = decimalsToWei(String(loanAmount), loanToken.decimals); // string repr of integer wei
    const feeWeiStr = calcFee(loanWeiStr, feeBps, 'round'); // string repr
    const repayWeiBig = BigInt(loanWeiStr) + BigInt(feeWeiStr);
    const repayWei = repayWeiBig.toString();

    // gas cost converted into loanToken units
    let gasCostInLoanToken = 0;
    if (ethPriceInLoanToken) {
      gasCostInLoanToken = Number(gasEstimateETH) / Number(ethPriceInLoanToken);
    } else {
      // assume midPrice = loanToken per ETH (1 ETH = midPrice loanToken)
      gasCostInLoanToken = gasEstimateETH * (midPrice || 1);
    }

    const assumedProfitRatio = body.assumedProfitRatio ?? 0.01;
    const loanAmountNum = Number(loanAmount);
    const grossProfit = loanAmountNum * assumedProfitRatio;
    const totalCostsLoanToken = (ethersFormat(repayWei, loanToken.decimals) - loanAmountNum) + gasCostInLoanToken;
    const netProfit = grossProfit - totalCostsLoanToken;

    const result = {
      success: true,
      loanToken,
      loanAmount,
      loanWei: loanWeiStr,
      feeWei: feeWeiStr,
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
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}