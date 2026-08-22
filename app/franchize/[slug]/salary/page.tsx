// app/franchize/[slug]/salary/page.tsx
import { Suspense } from "react";
import { SalaryClient } from "./SalaryClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { buildFranchizeSectionMetadata } from "../metadata";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Зарплата",
  sectionDescription: "Расчёт зарплаты участников экипажа",
  pathSuffix: "/salary",
});

interface SalaryPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SalaryPage({ params }: SalaryPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
  const callerUserId = verifyTelegramActorCookieValue(actorCookie);

  let isCrewMember = false;
  if (callerUserId) {
    // 2026-08-19 review: the salary page renders the owner-facing team
    // salary table (getOwnerSalaryOverview enforces owner-tier). Allow
    // owner / co_owner / admin only — regular members would otherwise
    // load the page UI and then see an error toast from the server action.
    // Members can still see their own earnings on their profile page.
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", callerUserId)
      .maybeSingle();
    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    // FranchizeCrewVM doesn't expose owner_id — fetch it from the crews
    // table directly.
    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", crew.slug || slug)
      .maybeSingle();
    const isOwnerByCrew = crewRow?.owner_id === callerUserId;

    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", callerUserId)
      .eq("membership_status", "active")
      .maybeSingle();
    const isCoOwner =
      ["co_owner", "admin"].includes(membership?.role || "");
    if (isOwnerByCrew || isAdmin || isCoOwner) {
      isCrewMember = true;
    }
  }

  if (!isCrewMember) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={surface.page}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold" style={{ color: surface.card.color }}>
            Доступ только для владельца, со-владельца или администратора
          </p>
          <p className="mt-1 text-xs" style={{ color: surface.card.borderColor }}>
            Свои доходы смотрите на странице профиля. Расчёт зарплаты команды — только для владельца экипажа.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/salary`} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
          <SalaryClient initialSlug={crew.slug || slug} initialCrew={crew} />
        </Suspense>
      </FranchizePageShell>
    </main>
  );
}
