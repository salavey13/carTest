import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_KEY || "");

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // optional filter: stream|blog|car etc
    let q = supabase.from("cars").select("id, type, slug, title, payload, created_at").order("created_at", { ascending: false }).limit(200);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // expected body: { type: "stream"|"blog", slug, title, payload: object }
    const { type, slug, title, payload } = body || {};
    if (!type || !slug || !title || !payload) {
      return NextResponse.json({ success: false, error: "type, slug, title and payload are required" }, { status: 400 });
    }

    const { data, error } = await supabase.from("cars").insert([{ type, slug, title, payload }]).select();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}