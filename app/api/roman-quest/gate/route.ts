// app/api/roman-quest/gate/route.ts — visibility gate for Roman's birthday
// quest (task154-iter3, boss: «gate the cakes! let them appear on pages only
// for vip-bike crew members and on PC (no tg auth) — hide for simple users
// if web app is opened»).
//
// Decision table:
//   no valid TG actor cookie  → show, mode "pc"     (PC / anonymous: cannot
//   identify the person; boss explicitly wants the quest visible there)
//   TG cookie + vip-bike crew → show, mode "crew"   (Roman & the crew)
//   TG cookie + everyone else → hide, mode "hidden"  (renters / simple users
//   inside the Telegram WebApp never see the cakes)
//
// The client caches the verdict in sessionStorage (roman-quest-gate) so the
// endpoint is hit at most once per browser session.

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
  mode: "pc" | "crew" | "hidden";
};

async function isVipBikeCrewMember(userId: string): Promise<boolean> {
  // Same membership contract as /franchize/[slug]/season-stats:
  // active crew_members row, OR the crew owner, OR a global admin.
  const [{ data: user }, { data: crewRow }] = await Promise.all([
    supabaseAdmin.from("users").select("metadata").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", "vip-bike")
      .maybeSingle(),
  ]);

  const meta = (user?.metadata || {}) as Record<string, unknown>;
  if (meta.role === "admin" || meta.status === "admin") return true;
  if (crewRow?.owner_id === userId) return true;
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
      const verdict: GateVerdict = { show: true, mode: "pc" };
      return NextResponse.json(verdict, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const member = await isVipBikeCrewMember(userId);
    const verdict: GateVerdict = member
      ? { show: true, mode: "crew" }
      : { show: false, mode: "hidden" };
    return NextResponse.json(verdict, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Fail-open: the quest is a harmless easter egg; a gate outage must not
    // hide the birthday surprise on Roman's machine.
    const verdict: GateVerdict = { show: true, mode: "pc" };
    return NextResponse.json(verdict, {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
