import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "", {
  auth: { persistSession: false },
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // optional filter
    const owner = url.searchParams.get("owner"); // optional
    let q = supabase
      .from("cars")
      .select("id, make, model, description, image_url, rent_link, daily_price, type, specs, owner_id, is_test_result, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (type) q = q.eq("type", type);
    if (owner) q = q.eq("owner_id", owner);

    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // expected: { id?, slug?, type, title, description, image_url, rent_link?, daily_price?, specs: object, owner_id? }
    const {
      id,
      slug,
      type,
      title,
      description,
      image_url,
      rent_link,
      daily_price = 0,
      specs = {},
      owner_id = null,
      is_test_result = false,
    } = body || {};

    if (!type || !title) {
      return NextResponse.json({ success: false, error: "type and title are required" }, { status: 400 });
    }

    // id fallback: slug or provided id
    const rowId = (slug || id || `${type}-${Date.now()}`).toString();

    // normalize fields to match cars schema
    const insertRow = {
      id: rowId,
      make: String(type).slice(0, 128), // not null
      model: String(title).slice(0, 256),
      description: description ?? "",
      image_url: image_url ?? "",
      rent_link: rent_link ?? "",
      daily_price: Number(daily_price) || 0,
      type: type,
      specs: specs,
      owner_id: owner_id,
      is_test_result: is_test_result,
    };

    const { data, error } = await supabase.from("cars").upsert(insertRow, { onConflict: "id" }).select();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}