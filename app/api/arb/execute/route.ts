import { NextRequest, NextResponse } from 'next/server';

/**
 * Body:
 * { plan, signerPrivateKey? } // For real usage you'd sign & send or flashbots bundle
 *
 * NOTE: This route is a stub. It DOES NOT sign on its own in this POC.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // for security, we do not accept raw private keys here in production.
    // For POC, we just echo back success.
    console.log('Execute called, plan length:', Array.isArray(body.plan) ? body.plan.length : 0);
    return NextResponse.json({ success: true, txHash: null, message: 'Stub: tx not sent. Implement executor (flashbots, signed tx) here.' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}