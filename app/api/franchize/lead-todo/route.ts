// app/api/franchize/lead-todo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../_auth";

/**
 * Manage lead-linked todos in crew_todos.
 *
 * POST   — create a todo linked to a lead (category: "lead_followup")
 * PATCH  — toggle todo status (pending ↔ done)
 * DELETE — remove a todo
 *
 * The lead_id is stored both in the dedicated lead_id column AND as
 * JSON inside description for backward-compatibility with older todo rows
 * that were created before the column was added.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewId, slug, leadId, leadName, title, priority } = body;

    // Auth check: only crew members can create lead todos
    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

    if (!crewId || !leadId || !title) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const todoId = `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Determine user_id (Telegram chat_id) and phone from leadId
    const todoUserId = /^\d{1,12}$/.test(leadId) ? leadId : null;
    const todoPhone = /^(\+?7|8)\d{10}$/.test(leadId) ? leadId : null;

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .insert({
        id: todoId,
        crew_id: crewId,
        lead_id: leadId,
        user_id: todoUserId,
        phone: todoPhone,
        title,
        description: JSON.stringify({
          lead_id: leadId,
          user_id: todoUserId,
          phone: todoPhone,
          lead_name: leadName || "",
        }),
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
    const { todoId, status, crewId } = body;

    // LR3-004 FIX: pass crewId to verifyCrewAccess (was missing → non-strict mode)
    // and add crew_id filter to the UPDATE query.
    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

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

    // LR3-004 FIX: add crew_id filter to prevent cross-crew todo toggling
    let query = supabaseAdmin
      .from("crew_todos")
      .update(updateData)
      .eq("id", todoId);
    if (crewId) query = query.eq("crew_id", crewId);
    const { error } = await query;

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
    const { todoId, dismissLead, leadId, crewId } = body;

    // Auth check: only crew members can delete todos / dismiss leads
    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

    // Dismiss a lead entirely (mark franchize_intents as dismissed)
    if (dismissLead && leadId) {
      // LR3-005 FIX: require slug explicitly (was defaulting to "vip-bike")
      if (!body.slug) {
        return NextResponse.json({ success: false, error: "Missing slug for dismiss" }, { status: 400 });
      }
      // Also dismiss the user (mark as not a lead) so they disappear from all lead sources
      await supabaseAdmin.from("users").update({
        metadata: { is_dismissed_lead: true, dismissed_at: new Date().toISOString() },
      }).eq("user_id", leadId);

      const { error } = await supabaseAdmin.from("franchize_intents").update({
        stage: "dismissed",
        updated_at: new Date().toISOString(),
      }).eq("telegram_user_id", leadId).eq("slug", body.slug);

      if (error) {
        logger.error("[lead-todo] dismiss lead failed", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (!todoId) {
      return NextResponse.json({ success: false, error: "Missing todoId" }, { status: 400 });
    }

    // LR3-005 FIX: add crew_id filter to prevent cross-crew todo deletion
    let deleteQuery = supabaseAdmin
      .from("crew_todos")
      .delete()
      .eq("id", todoId);
    if (crewId) deleteQuery = deleteQuery.eq("crew_id", crewId);
    const { error } = await deleteQuery;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[lead-todo] DELETE exception", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
