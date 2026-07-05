// app/api/franchize/lead-todo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

/**
 * Manage lead-linked todos in crew_todos.
 *
 * POST   — create a todo linked to a lead (category: "lead_followup")
 * PATCH  — toggle todo status (pending ↔ done)
 * DELETE — remove a todo
 *
 * The lead_id is stored in the todo's description as JSON:
 *   { lead_id: "userId", lead_name: "Иван" }
 *
 * This avoids needing a schema migration for a lead_id column.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewId, slug, leadId, leadName, title, priority } = body;

    if (!crewId || !leadId || !title) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const todoId = `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .insert({
        id: todoId,
        crew_id: crewId,
        title,
        description: JSON.stringify({ lead_id: leadId, lead_name: leadName || "" }),
        category: "lead_followup",
        status: "pending",
        priority: priority || "medium",
      })
      .select("*")
      .single();

    if (error) {
      logger.error("[lead-todo] insert failed", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, todo: data });
  } catch (error) {
    logger.error("[lead-todo] POST exception", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { todoId, status } = body;

    if (!todoId || !status) {
      return NextResponse.json({ success: false, error: "Missing todoId or status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "done") {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabaseAdmin
      .from("crew_todos")
      .update(updateData)
      .eq("id", todoId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[lead-todo] PATCH exception", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { todoId } = body;

    if (!todoId) {
      return NextResponse.json({ success: false, error: "Missing todoId" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("crew_todos")
      .delete()
      .eq("id", todoId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[lead-todo] DELETE exception", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
