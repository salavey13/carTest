import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/hooks/supabase";
import { syncWbStocks, syncOzonStocks, syncYmStocks } from "@/app/wb/actions";

export async function POST(request: Request) {
  const body = await request.json();
  const orderId = body.orderId?.toString() || null;

  if (!orderId) {
    return NextResponse.json({ success: false, error: "No order ID" }, { status: 400 });
  }

  try {
    // Dedup check
    const { data: existing } = await supabaseAdmin
      .from("processed_orders")
      .select("orderId")
      .eq("orderId", orderId)
      .eq("platform", "ym")
      .single();

    if (existing) {
      console.info(`YM webhook: duplicate order ${orderId}, skipping`);
      return NextResponse.json({ success: true, message: "Duplicate, skipped" });
    }

    // Process items
    const items = body.items || [];
    for (const it of items) {
      const sku = it.offerId?.toString();
      const qty = it.count || 1;
      if (sku) {
        await updateItemLocationQty(sku, "A1", -qty); // Default voxel or find
      }
    }

    // Add to processed
    await supabaseAdmin.from("processed_orders").insert({
      orderId,
      platform: "ym",
      items: items.map((it: any) => ({ sku: it.offerId, qty: it.count })),
      processedAt: new Date().toISOString(),
    });

    // Trigger syncs
//[captain]: think how to update particular item, not EVERYTHING;)
    await syncWbStocks();
    await syncOzonStocks();
    await syncYmStocks();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("YM webhook error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}