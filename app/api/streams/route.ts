export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    let q = supabase
      .from("cars")
      .select("id, type, make, model, description, specs, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (type) q = q.eq("type", type);

    const { data, error } = await q;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    // specs.slug / specs.payload достаём на UI
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, slug, title, payload } = body || {};
    if (!type || !slug || !title || !payload) {
      return NextResponse.json({ success: false, error: "type, slug, title and payload are required" }, { status: 400 });
    }

    const row = {
      id: `${type}-${slug}`,
      make: type,
      model: title,
      description: payload?.excerpt || "",
      image_url: payload?.image_url || "",
      rent_link: "",
      daily_price: 0,
      type,
      specs: { slug, payload },
    };

    const { data, error } = await supabase.from("cars").upsert(row, { onConflict: "id" }).select();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}