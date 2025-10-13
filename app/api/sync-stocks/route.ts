import { NextResponse } from "next/server";
import { syncWbStocks, syncOzonStocks, syncYmStocks } from "@/app/wb/actions";

export async function POST() {
  const wbRes = await syncWbStocks();
  const ozonRes = await syncOzonStocks();
  const ymRes = await syncYmStocks();

  if (!wbRes.success || !ozonRes.success || !ymRes.success) {
    return NextResponse.json({
      success: false,
      errors: [wbRes.error, ozonRes.error, ymRes.error].filter(Boolean),
    }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}