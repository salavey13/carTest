import { NextResponse } from "next/server";
import { pollWbOrders, pollOzonOrders, pollYmOrders } from "@/app/wb/auto-actions";
import { getYmCampaigns } from "@/app/wb/actions";

export async function GET() {
  try {
    await pollWbOrders();
    await pollOzonOrders();

    // Fetch active campaigns for YM
    const ymCamps = await getYmCampaigns();
    let ymId = process.env.YM_WAREHOUSE_ID;
    if (ymCamps.success && ymCamps.campaigns) {
      const avail = ymCamps.campaigns.find((c: any) => c.apiAvailability === "AVAILABLE");
      if (avail) ymId = String(avail.id);
    }
    if (ymId) await pollYmOrders(ymId);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("Poll orders error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}