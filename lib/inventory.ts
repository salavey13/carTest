// lib/inventory.ts
import { supabaseAdmin } from "@/hooks/supabase";
import { notifyAdmin } from "@/app/actions";

const LOW_STOCK_THRESHOLD = 100; // Threshold in ml

export async function processOrders() {
  // Fetch unprocessed orders
  const { data: unprocessedOrders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("processed", false);

  if (ordersError) {
    await notifyAdmin(`Error fetching unprocessed orders: ${ordersError.message}`);
    return;
  }

  if (!unprocessedOrders?.length) return;

  for (const order of unprocessedOrders) {
    const { id, service_type, car_size } = order;

    // Fetch consumption rate for this service type and car size
    const { data: serviceType } = await supabaseAdmin
      .from("service_types")
      .select("id")
      .eq("name", service_type)
      .single();
    const { data: carSize } = await supabaseAdmin
      .from("car_sizes")
      .select("id")
      .eq("name", car_size)
      .single();

    const { data: rates, error: rateError } = await supabaseAdmin
      .from("consumption_rates")
      .select("chemical_id, amount")
      .eq("service_type_id", serviceType?.id)
      .eq("car_size_id", carSize?.id);

    if (rateError || !rates) {
      await notifyAdmin(`Error fetching rates for order ${id}: ${rateError?.message || "No rates found"}`);
      continue;
    }

    for (const { chemical_id, amount } of rates) {
      const { data: chemical, error: chemError } = await supabaseAdmin
        .from("chemicals")
        .select("quantity, name")
        .eq("id", chemical_id)
        .single();

      if (chemError || !chemical) {
        await notifyAdmin(`Error fetching chemical ${chemical_id}: ${chemError?.message}`);
        continue;
      }

      const newQuantity = chemical.quantity - amount;
      const { error: updateError } = await supabaseAdmin
        .from("chemicals")
        .update({ quantity: newQuantity })
        .eq("id", chemical_id);

      if (updateError) {
        await notifyAdmin(`Error updating chemical ${chemical.name}: ${updateError.message}`);
        continue;
      }

      // Notify admin if stock is low
      if (newQuantity < LOW_STOCK_THRESHOLD) {
        await notifyAdmin(`Low stock alert: ${chemical.name} is at ${newQuantity} ml (below ${LOW_STOCK_THRESHOLD} ml).`);
      }
    }

    // Mark order as processed
    const { error: processError } = await supabaseAdmin
      .from("orders")
      .update({ processed: true })
      .eq("id", id);

    if (processError) {
      await notifyAdmin(`Error marking order ${id} as processed: ${processError.message}`);
    } else {
      await supabaseAdmin.from("processed_services").insert({ order_id: id });
    }
  }
}
