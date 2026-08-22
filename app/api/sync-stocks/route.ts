import { NextResponse } from "next/server";
import { syncWbStocks, syncOzonStocks } from "@/app/wb/actions";

export async function POST() {
  const wbRes = await syncWbStocks();
  const ozonRes = await syncOzonStocks();

  if (!wbRes.success || !ozonRes.success) {
    return NextResponse.json({
      success: false,
      errors: [wbRes.error, ozonRes.error].filter(Boolean),
    }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}