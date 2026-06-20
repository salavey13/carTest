import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const HANDOUT_ITEMS = [
  { id: 1, text: "Паспорт арендатора проверен" },
  { id: 2, text: "Водительское удостоверение проверено" },
  { id: 3, text: "Договор подписан обеими сторонами" },
  { id: 4, text: "Ключи переданы (___ шт.)" },
  { id: 5, text: "Шлем передан (___ шт.)" },
  { id: 6, text: "Уровень топлива/заряда отмечен" },
  { id: 7, text: "Повреждения зафиксированы на фото" },
  { id: 8, text: "Пробег зафиксирован" },
  { id: 9, text: "Инструктаж по эксплуатации проведён" },
  { id: 10, text: "Депозит получен" },
];

const RETURN_ITEMS = [
  { id: 11, text: "ТС возвращено без новых повреждений" },
  { id: 12, text: "Пробег совпадает с记录" },
  { id: 13, text: "Топливо/заряд на том же уровне" },
  { id: 14, text: "Ключи получены" },
  { id: 15, text: "Шлем получен" },
];

async function getChecklistState(type: "handout" | "return") {
  const { data, error } = await supabaseAdmin
    .from("checklist_state")
    .select("*")
    .eq("type", type)
    .maybeSingle();

  if (error || !data) {
    // Return default state
    const items = type === "handout" ? HANDOUT_ITEMS : RETURN_ITEMS;
    return {
      type,
      items: items.map((item) => ({ ...item, checked: false })),
      completedCount: 0,
      totalCount: items.length,
      updated_at: null,
    };
  }

  return {
    ...data,
    items: JSON.parse(data.items || "[]"),
  };
}

async function saveChecklistState(type: "handout" | "return", items: any[]) {
  const { data, error } = await supabaseAdmin
    .from("checklist_state")
    .upsert({
      type,
      items: JSON.stringify(items),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[checklists] upsert failed:", error);
    throw error;
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "handout" | "return" | null;

    if (!type || (type !== "handout" && type !== "return")) {
      return NextResponse.json({ error: "type must be 'handout' or 'return'" }, { status: 400 });
    }

    const state = await getChecklistState(type);
    return NextResponse.json(state);
  } catch (error) {
    console.error("[checklists] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, itemId, checked } = body;

    if (!type || (type !== "handout" && type !== "return")) {
      return NextResponse.json({ error: "type must be 'handout' or 'return'" }, { status: 400 });
    }

    if (itemId === undefined || checked === undefined) {
      return NextResponse.json({ error: "itemId and checked are required" }, { status: 400 });
    }

    const state = await getChecklistState(type);
    const updatedItems = state.items.map((item: any) =>
      item.id === itemId ? { ...item, checked } : item
    );

    await saveChecklistState(type, updatedItems);

    const completedCount = updatedItems.filter((i: any) => i.checked).length;

    return NextResponse.json({
      type,
      items: updatedItems,
      completedCount,
      totalCount: updatedItems.length,
      percentage: Math.round((completedCount / updatedItems.length) * 100),
    });
  } catch (error) {
    console.error("[checklists] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
