// app/franchize/[slug]/equipment/page.tsx
import { Suspense } from "react";
import { EquipmentClient } from "./EquipmentClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { buildFranchizeSectionMetadata } from "../metadata";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";

export const metadata = buildFranchizeSectionMetadata("vip-bike", {
  sectionTitle: "Оборудование",
  sectionDescription: "Каталог арендуемого оборудования экипажа",
});

interface EquipmentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function EquipmentPage({ params }: EquipmentPageProps) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);

  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
  const callerUserId = verifyTelegramActorCookieValue(actorCookie);

  let isCrewMember = false;
  if (callerUserId) {
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", callerUserId)
      .eq("membership_status", "active")
      .maybeSingle();
    if (membership && ["owner", "admin", "co_owner", "member"].includes(membership.role)) {
      isCrewMember = true;
    }
  }

  if (!isCrewMember) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={surface.page}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold" style={{ color: surface.card.color }}>
            Доступ только для участников экипажа
          </p>
          <p className="mt-1 text-xs" style={{ color: surface.card.borderColor }}>
            Откройте эту страницу через Telegram WebApp с привязанным аккаунтом.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${crew.slug || slug}/equipment`} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4">
        <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
          <EquipmentClient slug={crew.slug || slug} crew={crew} />
        </Suspense>
      </FranchizePageShell>
    </main>
  );
}
