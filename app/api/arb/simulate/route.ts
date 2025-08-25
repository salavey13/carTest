import { NextRequest, NextResponse } from 'next/server';
import { newLogic } from '@/lib/core';

/**
 * Body:
 * {
 *  plan: RouterLogic[] // produced on client after quote
 * }
 *
 * Return simulated result (success|revert, estimatedProfit)
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const plan = body.plan || [];

    // Very lightweight simulation: we just check basic structure and return a mocked profit.
    if (!Array.isArray(plan) || plan.length === 0) {
      return NextResponse.json({ success: false, error: 'empty plan' }, { status: 400 });
    }

    // mock calculation: profit = random small percent to emulate simulation
    const estimateProfitUSD = Number(body.estimateProfitUSD ?? 10);

    return NextResponse.json({
      success: true,
      simulated: true,
      estimateProfitUSD,
      message: 'Simulated OK — not actual on-chain call. For real sim use mainnet fork and eth_call.',
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}