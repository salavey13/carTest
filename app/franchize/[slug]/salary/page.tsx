// app/franchize/[slug]/salary/page.tsx
import { Suspense } from "react";
import { SalaryClient } from "./SalaryClient";
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { buildFranchizeSectionMetadata } from "../metadata";
import { cookies } from "next/headers";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";
import { AchievementExplorer } from "../../components/AchievementExplorer";
import { getSalaryVerificationStrip } from "../../server-actions/season-stats";
import { VerificationResendButton } from "../../components/VerificationResendButton";

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
      <AchievementExplorer slug={crew.slug || slug} achievementId="explorer_salary" />
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
        {/* Сверка расчётов × зарплата: сверенная часть выплат + ссылки на
            последние несверенные аренды (проверить/выслать сверку). */}
        <SalaryVerificationStripCard slug={crew.slug || slug} />
        <Suspense fallback={<div className="text-center py-12">Загрузка...</div>}>
          <SalaryClient initialSlug={crew.slug || slug} initialCrew={crew} />
        </Suspense>
      </FranchizePageShell>
    </main>
  );
}

async function SalaryVerificationStripCard({ slug }: { slug: string }) {
  const res = await getSalaryVerificationStrip({ slug });
  if (!res.success || !res.data) return null;
  const { payout, latestUnverified } = res.data;
  if (!payout && latestUnverified.length === 0) return null;
  const cardStyle = {
    backgroundColor: "color-mix(in srgb, currentColor 4%, transparent)",
    borderColor: "color-mix(in srgb, currentColor 14%, transparent)",
  } as const;
  const fmt = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))} ₽`;
  return (
    <section className="rounded-2xl border p-4 space-y-3" style={cardStyle} aria-label="Сверка выплат">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold">🤝 Сверка выплат — что уже подтверждено экипажем</h2>
        <Link href={`/franchize/${slug}/season-stats`} className="text-[11px] underline opacity-70 hover:opacity-100">
          сезон 2026 →
        </Link>
      </header>
      {payout && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border p-2.5" style={cardStyle}>
            <p className="text-[10px] uppercase font-bold opacity-60">✅ сверено к выплате</p>
            <p className="text-base md:text-lg font-black tabular-nums text-emerald-500">{fmt(payout.toPay.sum)}</p>
            <p className="text-[10px] opacity-60">{payout.toPay.count} аренд</p>
          </div>
          <div className="rounded-xl border p-2.5" style={cardStyle}>
            <p className="text-[10px] uppercase font-bold opacity-60">⏳ не сверено</p>
            <p className="text-base md:text-lg font-black tabular-nums text-amber-500">{fmt(payout.unverified.sum)}</p>
            <p className="text-[10px] opacity-60">{payout.unverified.count} аренд</p>
          </div>
          <div className="rounded-xl border p-2.5" style={cardStyle}>
            <p className="text-[10px] uppercase font-bold opacity-60">🏦 выплачено</p>
            <p className="text-base md:text-lg font-black tabular-nums">{fmt(payout.paid.sum)}</p>
            <p className="text-[10px] opacity-60">{payout.paid.count} аренд</p>
          </div>
        </div>
      )}
      {latestUnverified.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold opacity-70">Последние несверенные — проверь парой тапов:</p>
          {latestUnverified.map((r) => (
            <div key={r.rentalId} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2.5 py-1.5 text-xs" style={cardStyle}>
              <Link href={`/franchize/${slug}/rental/${r.rentalId}`} className="font-semibold underline-offset-2 hover:underline">
                {r.title}
              </Link>
              <span className="opacity-60">{r.startedAt}</span>
              {r.renter && <span className="opacity-80 truncate max-w-[160px]">{r.renter}</span>}
              <b className="ml-auto tabular-nums">{fmt(r.total)}</b>
              <VerificationResendButton slug={slug} rentalId={r.rentalId} compact accentColor="#f59e0b" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
