import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { format, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dateStart = startOfDay(targetDate).toISOString();
    const dateEnd = endOfDay(targetDate).toISOString();

    const { data, error } = await supabaseAdmin
      .from("todos")
      .select("*")
      .gte("created_at", dateStart)
      .lte("created_at", dateEnd)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[todos] query failed:", error);
      return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
    }

    return NextResponse.json({
      todos: data || [],
      date: format(targetDate, "yyyy-MM-dd"),
    });
  } catch (error) {
    console.error("[todos] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, date } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const targetDate = date ? new Date(date) : new Date();
    const dateStart = startOfDay(targetDate).toISOString();
    const dateEnd = endOfDay(targetDate).toISOString();

    // Check if todo already exists for this date
    const { data: existing } = await supabaseAdmin
      .from("todos")
      .select("*")
      .eq("text", text.trim())
      .gte("created_at", dateStart)
      .lte("created_at", dateEnd)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Todo already exists" }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from("todos")
      .insert({
        text: text.trim(),
        created_at: new Date().toISOString(),
        completed: false,
      })
      .select()
      .single();

    if (error) {
      console.error("[todos] insert failed:", error);
      return NextResponse.json({ error: "Failed to create todo" }, { status: 500 });
    }

    return NextResponse.json({ todo: data });
  } catch (error) {
    console.error("[todos] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, completed } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("todos")
      .update({ completed: completed === true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[todos] update failed:", error);
      return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
    }

    return NextResponse.json({ todo: data });
  } catch (error) {
    console.error("[todos] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("todos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[todos] delete failed:", error);
      return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[todos] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
