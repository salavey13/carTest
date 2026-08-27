import { NextResponse } from "next/server";

// Query-param driven GET (reads request.url) → never statically prerender.
export const dynamic = "force-dynamic";
import { supabaseAdmin, upsertRow } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type"); // optional filter
    const owner = url.searchParams.get("owner"); // optional
    let q = supabaseAdmin
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
    // expected: { id?, slug?, type, title?, description?, image_url?, rent_link?, daily_price?, specs?, owner_id?, make?, model? }
    // FIX: now respects explicit `make` and `model` if provided (previously always overwrote with type/title).
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
      make: explicitMake,
      model: explicitModel,
    } = body || {};

    if (!type) {
      return NextResponse.json({ success: false, error: "type is required" }, { status: 400 });
    }
    // title is optional if make/model are provided directly
    if (!title && !explicitMake && !explicitModel) {
      return NextResponse.json({ success: false, error: "either (type+title) or (type+make+model) is required" }, { status: 400 });
    }

    // id fallback: slug or provided id
    const rowId = (slug || id || `${type}-${Date.now()}`).toString();

    // normalize fields to match cars schema — prefer explicit make/model, fall back to type/title
    const insertRow = {
      id: rowId,
      make: String(explicitMake ?? type).slice(0, 128), // not null
      model: String(explicitModel ?? title ?? "").slice(0, 256),
      description: description ?? "",
      image_url: image_url ?? "",
      rent_link: rent_link ?? "",
      daily_price: Number(daily_price) || 0,
      type: type,
      specs: specs,
      owner_id: owner_id,
      is_test_result: is_test_result,
    };

    const { data, error } = await upsertRow("cars", insertRow, { onConflict: "id" });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}

// Backward-compatible alias for older clients that still send PUT for upsert.
export async function PUT(request: Request) {
  return POST(request);
}

// PATCH /api/cars?id=<vehicleId> — partial update of a single car row.
// Uses supabaseAdmin (bypasses RLS) so franchise admins can update bikes they don't own directly.
// Body: any subset of { make, model, description, image_url, rent_link, daily_price, specs, owner_id, is_test_result, type }
// Returns: { success, data, updatedCount } — updatedCount is 0 if no row matched the id (silent RLS failure guard).
export async function PATCH(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "?id=<vehicleId> query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const allowedKeys = ["make", "model", "description", "image_url", "rent_link", "daily_price", "specs", "owner_id", "is_test_result", "type"] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (body && key in body) {
        patch[key] = body[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    // Special-case `specs` so partial updates merge with existing specs instead of replacing.
    // This is critical for VIN quick-edit: CarSubmissionForm sends the FULL rebuilt specs object,
    // but other callers may want to patch just `specs.vin` — handle both safely.
    if ("specs" in patch && typeof patch.specs === "object" && patch.specs !== null) {
      // Read current specs first, then merge — this prevents accidental field loss
      const { data: existing, error: readErr } = await supabaseAdmin
        .from("cars")
        .select("specs")
        .eq("id", id)
        .maybeSingle();
      if (readErr) {
        return NextResponse.json({ success: false, error: `Failed to read existing specs: ${readErr.message}` }, { status: 500 });
      }
      const existingSpecs = (existing?.specs && typeof existing.specs === "object") ? existing.specs as Record<string, unknown> : {};
      patch.specs = { ...existingSpecs, ...(patch.specs as Record<string, unknown>) };
    }

    const { data, error, count } = await supabaseAdmin
      .from("cars")
      .update(patch)
      .eq("id", id)
      .select("id, make, model, specs, type, owner_id")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      // No row matched this id — surface this so the client can show a meaningful error
      return NextResponse.json({ success: false, error: `No car row found with id=${id}`, updatedCount: 0 }, { status: 404 });
    }

    return NextResponse.json({ success: true, data, updatedCount: 1 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}
