import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/hooks/supabase";
import { syncWbStocks, syncOzonStocks, syncYmStocks } from "@/app/wb/actions";

export async function POST(request: Request) {
  const body = await request.json();
  const orderId = body.posting_number?.toString() || null; // Ozon posting_number as orderId

  if (!orderId) {
    return NextResponse.json({ success: false, error: "No order ID" }, { status: 400 });
  }

  try {
    // Dedup check
    const { data: existing } = await supabaseAdmin
      .from("processed_orders")
      .select("orderId")
      .eq("orderId", orderId)
      .eq("platform", "ozon")
      .single();

    if (existing) {
      console.info(`Ozon webhook: duplicate order ${orderId}, skipping`);
      return NextResponse.json({ success: true, message: "Duplicate, skipped" });
    }

    // Process items
    const items = body.products || [];
    for (const it of items) {
      const sku = it.sku?.toString();
      const qty = it.quantity || 1;
      if (sku) {
        await updateItemLocationQty(sku, "A1", -qty); // Default voxel or find
      }
    }

    // Add to processed
    await supabaseAdmin.from("processed_orders").insert({
      orderId,
      platform: "ozon",
      items: items.map((it: any) => ({ sku: it.sku, qty: it.quantity })),
      processedAt: new Date().toISOString(),
    });

    // Trigger syncs
//[captain]: looks kinda fork bomb to me:)
    await syncWbStocks();
    await syncOzonStocks();
    await syncYmStocks();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Ozon webhook error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}