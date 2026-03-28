"use server";

import { notifyAdmin } from "@/app/actions";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface ConfiguratorBatteryOption {
  capacity: string;
  type: "regular" | "lithium";
  battery_price: number;
  total_price: number;
  range_km: string;
}

export interface ConfiguratorBike {
  id: string;
  make: string;
  model: string;
  description: string;
  daily_price: number;
  image_url: string;
  rent_link: string | null;
  specs: {
    power_w?: number;
    power_kw?: number;
    max_speed_kmh?: string;
    subtitle?: string;
    tier?: string;
    gallery?: string[];
    battery_options?: {
      base_price?: number;
      batteries?: ConfiguratorBatteryOption[];
    };
  };
  type: string;
  quantity: number;
}

export interface ConfiguratorPart {
  id: string;
  make: string;
  model: string;
  description: string;
  daily_price: number;
  image_url: string;
  specs: {
    category?: string;
  };
  type: string;
}

export async function loadConfiguratorCatalog() {
  const bikesQuery = await supabaseAdmin
    .from("cars")
    .select("id, make, model, description, daily_price, image_url, rent_link, specs, type, quantity")
    .eq("type", "ebike")
    .order("daily_price", { ascending: true });

  const partsQuery = await supabaseAdmin
    .from("cars")
    .select("id, make, model, description, daily_price, image_url, specs, type")
    .eq("type", "parts")
    .order("daily_price", { ascending: true });

  const ebikes = (bikesQuery.data ?? []) as ConfiguratorBike[];
  const parts = (partsQuery.data ?? []) as ConfiguratorPart[];

  return {
    ok: true,
    ebikes,
    parts,
    hasLiveEbikeData: ebikes.length > 0,
    hasLivePartsData: parts.length > 0,
    bikeError: bikesQuery.error?.message,
    partsError: partsQuery.error?.message,
  };
}

export async function sendConfiguratorLead(input: {
  bikeId: string;
  bikeLabel: string;
  motorLabel: string;
  batteryLabel: string;
  selectedAccessories: Array<{ name: string; price: number }>;
  withDelivery: boolean;
  deliveryPrice: number;
  total: number;
}) {
  const accessoriesLine = input.selectedAccessories.length
    ? input.selectedAccessories.map((item) => `${item.name} (${item.price.toLocaleString("ru-RU")} ₽)`).join(", ")
    : "без доп. опций";

  const message = [
    "🛒 Новый лид из /franchize/vip-bike/configurator",
    `🏍️ Модель: ${input.bikeLabel} (${input.bikeId})`,
    `⚡ Мотор: ${input.motorLabel}`,
    `🔋 Батарея: ${input.batteryLabel}`,
    `🧩 Опции: ${accessoriesLine}`,
    `🚚 Доставка: ${input.withDelivery ? `включена (${input.deliveryPrice.toLocaleString("ru-RU")} ₽)` : "без доставки"}`,
    `💰 Итого: ${input.total.toLocaleString("ru-RU")} ₽`,
  ].join("\n");

  const result = await notifyAdmin(message);
  return result.success
    ? { success: true }
    : { success: false, error: result.error ?? "Не удалось отправить уведомление" };
}
