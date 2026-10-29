// app/api/roman-quest/gate/route.ts — audience decision for the FEATURE TOUR
// (task164, boss audio «BESTSELLER» 29.10: the birthday quest becomes a
// self-promoting product tour — «если кто-то другой заходит вместо Романа,
// ему не поздравление: всё то же самое, всё покажу, всё также расскажу,
// интересно, только он ещё может нажать кнопку [купить]»).
//
// Decision table (v2 — everyone sees the tour, the BIRTHDAY skin is Roman's):
//   no TG actor cookie            → skin "tour",    role "guest"  (anonymous PC: sales tour)
//   cookie + ROMAN_TG_USER_IDS    → skin "birthday", role "roman"  (cakes, riddles, подарок)
//   cookie + owns ANY crew        → skin "tour",    role "owner"  (+crewSlug: activation checkboxes)
//   cookie + active vip-bike member (non-owning)    → skin "tour", role "member"
//   cookie + everyone else        → skin "tour",    role "guest"  (renters: the tour is the funnel)
//
// task165: the verdict carries `authenticated` — the ⭐ CTA turns into a REAL
// Telegram-Stars purchase (app/roman-quest/actions.ts) only for TG sessions;
// anonymous PC users keep the demo dialog (an invoice needs a chat_id).
//
// The client caches the verdict in sessionStorage (roman-quest-gate-v2 —
// bumped so stale v1 "hidden" verdicts can't suppress the new tour).
// Roman's id list is env-overridable (ROMAN_TG_USER_IDS, comma-separated);
// default pins Роман Воробьёв (co_owner, 244736261 — «Электро-первопроходец»).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type GateVerdict = {
  show: boolean;
  skin: "birthday" | "tour";
  role: "roman" | "owner" | "member" | "guest";
  crewSlug?: string;
  /** TG session present — the ⭐ CTA can send a REAL Stars invoice. */
  authenticated: boolean;
};

const DEFAULT_ROMAN_TG_IDS = "244736261";

function romanIdSet(): Set<string> {
  const raw = (process.env.ROMAN_TG_USER_IDS || DEFAULT_ROMAN_TG_IDS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(raw);
}

/** The crew a user OWNS (owner_id column) — the activation checkboxes act on it. */
async function ownedCrewSlug(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("crews")
    .select("slug")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.slug ?? null;
}

async function isVipBikeMember(userId: string): Promise<boolean> {
  // Same membership contract as /franchize/[slug]/season-stats:
  // active crew_members row, OR a global admin (owner is covered by ownedCrewSlug).
  const [{ data: user }, { data: crewRow }] = await Promise.all([
    supabaseAdmin.from("users").select("metadata").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", "vip-bike")
      .maybeSingle(),
  ]);

  const meta = (user?.metadata || {}) as Record<string, unknown>;
  if (meta.role === "admin" || meta.status === "admin") return true;
  if (!crewRow?.id) return false;

  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("membership_status")
    .eq("crew_id", crewRow.id)
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .maybeSingle();

  return Boolean(membership);
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = verifyTelegramActorCookieValue(
      cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    if (!userId) {
      const verdict: GateVerdict = { show: true, skin: "tour", role: "guest", authenticated: false };
      return NextResponse.json(verdict, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (romanIdSet().has(userId)) {
      const verdict: GateVerdict = { show: true, skin: "birthday", role: "roman", authenticated: true };
      return NextResponse.json(verdict, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const crewSlug = await ownedCrewSlug(userId);
    if (crewSlug) {
      const verdict: GateVerdict = { show: true, skin: "tour", role: "owner", crewSlug, authenticated: true };
      return NextResponse.json(verdict, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const member = await isVipBikeMember(userId);
    const verdict: GateVerdict = member
      ? { show: true, skin: "tour", role: "member", authenticated: true }
      : { show: true, skin: "tour", role: "guest", authenticated: true };
    return NextResponse.json(verdict, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Fail-open: the tour is a harmless marketing surface; a gate outage must
    // not blank anything. Guests see the tour.
    const verdict: GateVerdict = { show: true, skin: "tour", role: "guest", authenticated: false };
    return NextResponse.json(verdict, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
