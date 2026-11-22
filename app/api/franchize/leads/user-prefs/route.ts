// app/api/franchize/leads/user-prefs/route.ts
//
// ── НАСТРОЙКИ СТРАНИЦЫ ЛИДОВ в metadata пользователя (jsonb) ────────────────
//
// КЛИЕНТСКАЯ ПРОСЬБА: «save filters settings upon page reload (save to
// user's metadata jsonb)». Фильтры/сортировка/вид/флаг заглушек + состояние
// геймификационного «Пути оператора» (какой шаг открыт) живут в
// public.users.metadata под ключами leads_ui / leads_path — настройки
// переживают перезагрузку, смену устройства и чистку localStorage.
//
// GET  ?slug=…  → { success, prefs, path, persisted }
// POST { slug, prefs?, path? } → выборочная запись (jsonb_set, атомарно).
//
// Auth: тот же verifyCrewAccess, что у остальных franchize-роутов (подписанная
// TG-cookie → заголовок → пароль). Парольные зрители (userId="password-auth")
// не имеют строки в users — сохранение недоступно (клиент падает back на
// localStorage), GET отвечает persisted:false.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { verifyCrewAccess } from "../../_auth";

export const dynamic = "force-dynamic";

// ── Whitelist + санитизация (metadata пишет сам пользователь — ничего не
// доверяем: только известные ключи, известные значения, разумные длины). ──

const SEGMENTS = new Set(["all", "hot", "verified", "warm", "troubled"]);
const SORTS = new Set(["priority", "recent", "urgent", "name", "spent"]);
const VIEWS = new Set(["list", "board", "table"]);

const cleanStr = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length === 0 ? undefined : s.slice(0, max);
};

export interface LeadsUiPrefs {
  q?: string;
  source?: string;
  stage?: string;
  owner?: string;
  segment?: string;
  hidePlaceholders?: boolean;
  /** Фильтр «С заметками»: только лиды с заметками оператора. */
  humanNotes?: boolean;
  sortMode?: string;
  viewMode?: string;
}

export interface LeadsPathState {
  /** Сколько шагов «Пути оператора» открыто (растёт по дням/достижениям). */
  revealed?: number;
  /** Календарный день последнего «drip»-открытия (YYYY-MM-DD). */
  lastRevealDay?: string;
  /** Отмеченные пройденными шаги (id) — чтобы не праздновать дважды. */
  celebrated?: string[];
}

function sanitizePrefs(raw: unknown): LeadsUiPrefs | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: LeadsUiPrefs = {};
  const q = cleanStr(r.q, 200);
  const source = cleanStr(r.source, 80);
  const stage = cleanStr(r.stage, 80);
  const owner = cleanStr(r.owner, 120);
  if (q) out.q = q;
  if (source) out.source = source;
  if (stage) out.stage = stage;
  if (owner) out.owner = owner;
  if (typeof r.segment === "string" && SEGMENTS.has(r.segment)) out.segment = r.segment;
  if (typeof r.hidePlaceholders === "boolean") out.hidePlaceholders = r.hidePlaceholders;
  if (typeof r.humanNotes === "boolean") out.humanNotes = r.humanNotes;
  if (typeof r.sortMode === "string" && SORTS.has(r.sortMode)) out.sortMode = r.sortMode;
  if (typeof r.viewMode === "string" && VIEWS.has(r.viewMode)) out.viewMode = r.viewMode;
  return Object.keys(out).length > 0 ? out : null;
}

function sanitizePath(raw: unknown): LeadsPathState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: LeadsPathState = {};
  if (typeof r.revealed === "number" && Number.isFinite(r.revealed)) {
    out.revealed = Math.max(0, Math.min(50, Math.floor(r.revealed)));
  }
  const day = cleanStr(r.lastRevealDay, 10);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) out.lastRevealDay = day;
  if (Array.isArray(r.celebrated)) {
    out.celebrated = r.celebrated
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.slice(0, 60))
      .slice(0, 20);
  }
  return Object.keys(out).length > 0 ? out : null;
}

async function resolveCrewId(slug: string): Promise<string | null> {
  const { data: crew } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return crew?.id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const slug = new URL(request.url).searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json({ success: false, error: "Missing slug" }, { status: 400 });
    }
    const crewId = await resolveCrewId(slug);
    if (!crewId) {
      return NextResponse.json({ success: false, error: "Crew not found" }, { status: 404 });
    }
    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;

    // Парольные зрители не имеют строки в users — persisted:false, клиент
    // держит настройки в localStorage (см. useLeadsUserPrefs).
    if (auth.userId === "password-auth") {
      return NextResponse.json({ success: true, prefs: null, path: null, persisted: false });
    }
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", auth.userId)
      .maybeSingle();
    const meta = (user?.metadata ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      prefs: sanitizePrefs(meta.leads_ui),
      path: sanitizePath(meta.leads_path),
      persisted: true,
    });
  } catch (error) {
    logger.error("[leads/user-prefs GET] failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug) {
      return NextResponse.json({ success: false, error: "Missing slug" }, { status: 400 });
    }
    const prefs = sanitizePrefs(body?.prefs);
    const path = sanitizePath(body?.path);
    if (!prefs && !path) {
      return NextResponse.json({ success: false, error: "Nothing to save" }, { status: 400 });
    }
    const crewId = await resolveCrewId(slug);
    if (!crewId) {
      return NextResponse.json({ success: false, error: "Crew not found" }, { status: 404 });
    }
    const auth = await verifyCrewAccess(request, crewId);
    if (auth.ok === false) return auth.response;
    if (auth.userId === "password-auth") {
      return NextResponse.json({ success: true, persisted: false });
    }

    // Read-modify-write только своих ключей (leads_ui/leads_path): остальные
    // ключи metadata не трогаются. Гонка некритична (настройки одного зрителя,
    // last-write-wins), зато типобезопасно без supabaseAdmin.sql.
    const { data: currentUser, error: readError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (readError) {
      logger.error("[leads/user-prefs POST] read failed:", readError);
      return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
    }
    const merged = { ...((currentUser?.metadata ?? {}) as Record<string, unknown>) };
    if (prefs) merged.leads_ui = prefs;
    if (path) merged.leads_path = path;
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ metadata: merged })
      .eq("user_id", auth.userId);
    if (updateError) {
      logger.error("[leads/user-prefs POST] update failed:", updateError);
      return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    logger.error("[leads/user-prefs POST] failed:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
