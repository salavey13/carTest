// app/api/roman-quest/activations/route.ts — per-crew feature activation for
// the BESTSELLER tour (task164, boss audio «BESTESTCONFIGURER»: «для
// владельца криу показывать галочки, чтобы активировать его криу — даже если
// он по чужой криу лазит»). The flags land in crews.metadata.feature_tour of
// the crew the session user OWNS — never the crew whose page he is browsing.
//
//   GET   → { crewSlug, features } — the owner's own flags ({} for others).
//   POST  { featureKey, value }    → owner-only toggle; validates the key
//           against TOUR_FEATURE_KEYS; merges metadata (never overwrites the
//           rest of the crew's config); returns the fresh flag set.
//
// This is the first real per-crew feature-flag store: the tour sells it, the
// menu link (crews.metadata.franchize.header.menuLinks) shows it, and future
// sprints can enforce the flags anywhere.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  verifyTelegramActorCookieValue,
  TELEGRAM_ACTOR_COOKIE,
} from "@/lib/telegram-actor-cookie";
import { supabaseAdmin } from "@/lib/supabase-server";
import { TOUR_FEATURE_KEYS } from "@/components/roman-gift/tourFeatures";

export const dynamic = "force-dynamic";

type CrewMeta = Record<string, unknown> & { feature_tour?: Record<string, boolean> };

async function sessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyTelegramActorCookieValue(
    cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value,
  );
}

async function ownedCrew(userId: string): Promise<{ id: string; slug: string; metadata: CrewMeta } | null> {
  const { data } = await supabaseAdmin
    .from("crews")
    .select("id, slug, metadata")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id,
    slug: data.slug,
    metadata: (data.metadata || {}) as CrewMeta,
  };
}

function flagsOf(meta: CrewMeta): Record<string, boolean> {
  const raw = (meta.feature_tour || {}) as Record<string, unknown>;
  const flags: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "boolean") flags[k] = v;
  }
  return flags;
}

export async function GET() {
  try {
    const userId = await sessionUserId();
    if (!userId) return NextResponse.json({ crewSlug: null, features: {} });
    const crew = await ownedCrew(userId);
    if (!crew) return NextResponse.json({ crewSlug: null, features: {} });
    return NextResponse.json(
      { crewSlug: crew.slug, features: flagsOf(crew.metadata) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ crewSlug: null, features: {} });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await sessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const crew = await ownedCrew(userId);
    if (!crew) {
      return NextResponse.json(
        { error: "not-owner", message: "Галочки активации — только для владельцев экипажей." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { featureKey?: string; value?: unknown }
      | null;
    const featureKey = typeof body?.featureKey === "string" ? body.featureKey : "";
    if (!featureKey || !TOUR_FEATURE_KEYS.has(featureKey)) {
      return NextResponse.json({ error: "bad-feature-key" }, { status: 400 });
    }
    const value = body?.value === true;

    // Re-read right before the write (the GET at page load may be stale) and
    // MERGE — the same metadata also carries franchize UI config (menuLinks,
    // theme, contacts): a blind overwrite would nuke the crew's storefront.
    const { data: fresh } = await supabaseAdmin
      .from("crews")
      .select("metadata")
      .eq("id", crew.id)
      .maybeSingle();
    const meta = ((fresh?.metadata || {}) as CrewMeta);
    const nextFlags = { ...flagsOf(meta), [featureKey]: value };
    const merged = { ...meta, feature_tour: nextFlags };

    const { error: updateError } = await supabaseAdmin
      .from("crews")
      .update({ metadata: merged })
      .eq("id", crew.id);
    if (updateError) {
      return NextResponse.json({ error: "write-failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, crewSlug: crew.slug, features: nextFlags });
  } catch {
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
