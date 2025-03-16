// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/hooks/supabase";
import { notifyAdmin } from "@/app/actions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { crm_name, service_id, service_type, car_size, completed_at } = body;

    if (!crm_name || !service_id) {
      return NextResponse.json({ error: "Missing required fields: crm_name and service_id" }, { status: 400 });
    }

    // Check if order already exists (using crm_name and service_id as unique identifiers)
    const { data: existingOrder, error: checkError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("crm_name", crm_name)
      .eq("service_id", service_id)
      .single();

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = no rows found
      await notifyAdmin(`Error checking existing order: ${checkError.message}`);
      return NextResponse.json({ error: "Failed to verify order" }, { status: 500 });
    }

    if (existingOrder) {
      return NextResponse.json({ message: "Order already exists" }, { status: 200 });
    }

    // Insert new order
    const { error: insertError } = await supabaseAdmin.from("orders").insert({
      crm_name,
      service_id,
      service_type,
      car_size,
      completed_at: completed_at || new Date().toISOString(),
      processed: false,
    });

    if (insertError) {
      await notifyAdmin(`Error inserting order ${crm_name}/${service_id}: ${insertError.message}`);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    await notifyAdmin(`New order added: ${crm_name}/${service_id}`);
    return NextResponse.json({ message: "Order added successfully" }, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    await notifyAdmin(`Webhook error: ${errorMessage}`);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
