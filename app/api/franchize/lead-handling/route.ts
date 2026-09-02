// app/api/franchize/lead-handling/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../_auth";
import {
  LEAD_HANDLING_CATEGORY,
  HANDLED_TITLE,
  CALLBACK_TITLE,
  isHandledTodo,
  isCallbackTodo,
} from "@/app/franchize/[slug]/leads/lib/lead-handling";

/**
 * LEAD HANDLING STATE — «Отработан» + «Перезвонить в ...»
 *
 * POST body:
 *   {
 *     crewId: string,            // crew UUID
 *     leadId: string,            // lead key (TG id / phone / "avito:…")
 *     leadName?: string,         // для читаемой истории
 *     action: "handled"          // отметить «отработан»
 *          | "unhandled"         // снять «отработан»
 *          | "set_callback"      // назначить перезвон (callbackAt, note?)
 *          | "clear_callback"    // убрать перезвон
 *          | "complete_callback" // перезвонили: закрыть напоминание + отметить «отработан»
 *     callbackAt?: string,       // ISO datetime — обязательный для set_callback
 *     note?: string,             // заметка к перезвону («после 18:00»)
 *   }
 *
 * Состояние хранится в crew_todos под category="lead_handling" — эти строки
 * транслируются на страницу лидов штатным путём (getFranchizeLeads → todos)
 * и матчатся к лиду по lead_id/user_id/phone (см. lib/lead-handling.ts).
 * Ответ возвращает актуальные handling-строки, чтобы клиент обновил state
 * без полного re-fetch.
 */

const TODO_ID_PREFIX = "handling";

function newTodoId(): string {
  return `${TODO_ID_PREFIX}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Идентифицирует phone/TG-форму ключа лида, чтобы заполнить user_id/phone. */
function leadKeyColumns(leadId: string): { user_id: string | null; phone: string | null } {
  if (/^\d{1,12}$/.test(leadId)) return { user_id: leadId, phone: null };
  if (/^(\+?7|8)\d{10}$/.test(leadId)) return { user_id: null, phone: leadId };
  // "avito:…", UUID-ключи и прочее — только lead_id-колонка
  return { user_id: null, phone: null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crewId, leadId, leadName, action, callbackAt, note } = body;

    if (!crewId || !leadId || !action) {
      return NextResponse.json(
        { success: false, error: "Missing crewId / leadId / action" },
        { status: 400 },
      );
    }

    const validActions = ["handled", "unhandled", "set_callback", "clear_callback", "complete_callback"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (action === "set_callback" && !callbackAt) {
      return NextResponse.json(
        { success: false, error: "callbackAt обязателен для set_callback" },
        { status: 400 },
      );
    }

    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

    const { user_id, phone } = leadKeyColumns(String(leadId));
    const nowIso = new Date().toISOString();
    const actor = auth.userId || null;

    // Текущие handling-строки этого лида (crew-фильтр + lead_id + категория).
    const { data: existingRows, error: fetchErr } = await supabaseAdmin
      .from("crew_todos")
      .select("*")
      .eq("crew_id", crewId)
      .eq("lead_id", String(leadId))
      .eq("category", LEAD_HANDLING_CATEGORY)
      .order("created_at", { ascending: true })
      .limit(20);
    if (fetchErr) {
      logger.error("[lead-handling] fetch failed", fetchErr);
      return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 });
    }

    const handledRows = (existingRows || []).filter((r: any) => isHandledTodo(r));
    const callbackRows = (existingRows || []).filter((r: any) => isCallbackTodo(r) && r.status !== "done");

    /** upsert «отработан» */
    const markHandled = async () => {
      if (handledRows.length > 0) {
        // уже есть — обновляем время отметки (re-mark)
        const { data, error } = await supabaseAdmin
          .from("crew_todos")
          .update({ status: "done", completed_at: nowIso, updated_at: nowIso })
          .eq("id", handledRows[0].id)
          .eq("crew_id", crewId)
          .select("*");
        if (error) throw error;
        return data || [];
      }
      const { data, error } = await supabaseAdmin
        .from("crew_todos")
        .insert({
          id: newTodoId(),
          crew_id: crewId,
          lead_id: String(leadId),
          user_id,
          phone,
          title: HANDLED_TITLE,
          description: JSON.stringify({ kind: "handled", lead_id: String(leadId), lead_name: leadName || "", marked_by: actor }),
          category: LEAD_HANDLING_CATEGORY,
          status: "done",
          priority: "low",
          completed_at: nowIso,
          created_by: actor,
        })
        .select("*");
      if (error) throw error;
      return data || [];
    };

    try {
      let touched: any[] = [];

      switch (action) {
        case "handled": {
          touched = await markHandled();
          break;
        }

        case "unhandled": {
          if (handledRows.length > 0) {
            await supabaseAdmin
              .from("crew_todos")
              .delete()
              .eq("id", handledRows.map((r: any) => r.id))
              .eq("crew_id", crewId);
          }
          break;
        }

        case "set_callback": {
          // заменяем существующее активное напоминание одним свежим
          if (callbackRows.length > 0) {
            await supabaseAdmin
              .from("crew_todos")
              .delete()
              .eq("id", callbackRows.map((r: any) => r.id))
              .eq("crew_id", crewId);
          }
          const dueIso = new Date(String(callbackAt));
          if (Number.isNaN(dueIso.getTime())) {
            return NextResponse.json({ success: false, error: "Некорректное время перезвона" }, { status: 400 });
          }
          const { data, error } = await supabaseAdmin
            .from("crew_todos")
            .insert({
              id: newTodoId(),
              crew_id: crewId,
              lead_id: String(leadId),
              user_id,
              phone,
              title: CALLBACK_TITLE,
              description: JSON.stringify({
                kind: "callback",
                note: typeof note === "string" && note.trim() ? note.trim() : null,
                lead_id: String(leadId),
                lead_name: leadName || "",
                callback_at: dueIso.toISOString(),
                created_by: actor,
              }),
              category: LEAD_HANDLING_CATEGORY,
              status: "pending",
              priority: "high",
              due_date: dueIso.toISOString(),
              created_by: actor,
            })
            .select("*");
          if (error) throw error;
          touched = data || [];
          break;
        }

        case "clear_callback": {
          if (callbackRows.length > 0) {
            await supabaseAdmin
              .from("crew_todos")
              .delete()
              .eq("id", callbackRows.map((r: any) => r.id))
              .eq("crew_id", crewId);
          }
          break;
        }

        case "complete_callback": {
          // Перезвонили: закрываем напоминание (done + completed_at) и
          // автоматически отмечаем лид «отработан» — звонок состоялся.
          if (callbackRows.length > 0) {
            const { data, error } = await supabaseAdmin
              .from("crew_todos")
              .update({ status: "done", completed_at: nowIso, updated_at: nowIso })
              .eq("id", callbackRows.map((r: any) => r.id))
              .eq("crew_id", crewId)
              .select("*");
            if (error) throw error;
            touched = data || [];
          }
          const handledTouch = await markHandled();
          touched = [...touched, ...handledTouch];
          break;
        }
      }

      return NextResponse.json({ success: true, touched });
    } catch (error: any) {
      logger.error("[lead-handling] write failed", error);
      return NextResponse.json(
        { success: false, error: error?.message || "Write failed" },
        { status: 500 },
      );
    }
  } catch (error) {
    logger.error("[lead-handling] POST exception", error);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
