// app/franchize/[slug]/season-stats/page.tsx
//
// Сезон 2026 — динамическая статистика экипажа (аренды + продажи + касса +
// сверка расчётов). Данные грузятся порциями: обзор (кэш ~10 мин) + ленивые
// детали по месяцу. Инфографика рисуется кодом (CSS/SVG), без картинок.
import { getFranchizeBySlug } from "../../actions";
import { crewPaletteForSurface } from "../../lib/theme";
import { CrewHeader } from "../../components/CrewHeader";
import { FranchizePageShell } from "../../components/FranchizePageShell";
import { CrewFooter } from "../../components/CrewFooter";
import { buildFranchizeSectionMetadata } from "../metadata";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";
import { SeasonStatsClient, type SeasonStatsTokens } from "./SeasonStatsClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Сезон 2026",
    sectionDescription: "Сезонная статистика экипажа: аренды, продажи, касса и сверка расчётов",
    pathSuffix: "/season-stats",
  });
}

function themeTokens(theme: Parameters<typeof crewPaletteForSurface>[0]): SeasonStatsTokens {
  const hex = theme?.palettes?.dark || theme?.palettes?.light || theme?.palette;
  const v = (cssVar: string, fb: string, hexValue: string | undefined) =>
    theme?.isAuto ? `var(--franchize-${cssVar}, ${fb})` : hexValue || fb;
  return {
    bg: v("bg-base", "#0b1220", hex?.bgBase),
    card: v("bg-card", "#131c2e", hex?.bgCard),
    border: v("border-soft", "#243049", hex?.borderSoft),
    text: v("text-primary", "#f4f6fb", hex?.textPrimary),
    textMuted: v("text-secondary", "#8d99b5", hex?.textSecondary),
    accent: v("accent-main", "#f59e0b", hex?.accentMain),
  };
}

export default async function SeasonStatsPage({ params }: Props) {
  const { slug } = await params;
  const { crew, items } = await getFranchizeBySlug(slug);
  const surface = crewPaletteForSurface(crew.theme);
  const resolvedSlug = crew.slug || slug;
  const tokens = themeTokens(crew.theme);

  // Access: any active crew member can look at crew stats; owner-tier
  // (owner / co_owner / admin / global admin) additionally unlocks the
  // verification round + per-rental resend buttons (server-side gated too).
  const cookieStore = await cookies();
  const callerUserId = verifyTelegramActorCookieValue(cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value);

  let isMember = false;
  let ownerTier = false;
  if (callerUserId && crew.id) {
    const [{ data: user }, { data: crewRow }, { data: membership }] = await Promise.all([
      supabaseAdmin.from("users").select("metadata").eq("user_id", callerUserId).maybeSingle(),
      supabaseAdmin.from("crews").select("id, owner_id").eq("slug", resolvedSlug).maybeSingle(),
      supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", callerUserId)
        .eq("membership_status", "active")
        .maybeSingle(),
    ]);
    const meta = (user?.metadata || {}) as Record<string, unknown>;
    const isGlobalAdmin = meta.role === "admin" || meta.status === "admin";
    const isOwnerByCrew = crewRow?.owner_id === callerUserId;
    const role = membership?.role || "";
    const isActive = Boolean(membership) || isOwnerByCrew || isGlobalAdmin;
    isMember = isActive && (Boolean(membership) || isOwnerByCrew || isGlobalAdmin);
    ownerTier = isGlobalAdmin || isOwnerByCrew || ["co_owner", "admin"].includes(role);
  }

  if (!isMember) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={surface.page}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold" style={{ color: surface.card.color }}>
            Сезонная статистика доступна участникам экипажа
          </p>
          <p className="mt-1 text-xs" style={{ color: surface.mutedText.color }}>
            Войдите через Telegram WebApp, чтобы увидеть цифры своего экипажа.
          </p>
        </div>
        {/* task154 iter3: quest stop 7/7 lives in BOTH branches — the cake is
            an overlay, so the hunt works even on the locked PC fallback */}
        {slug === "vip-bike" && (
          <RomanQuestCake
            stop={7}
            riddle="Вот они, плоды общего дела — весь сезон до рубля. Остался последний шаг: прибавь к адресу сайта /gift/roman — и забери своё. Осталось нажать одну кнопку."
            nextHref="/gift/roman"
            nextLabel="Открыть подарок"
          />
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={`/franchize/${resolvedSlug}/season-stats`} showRail={false} items={items} />
      <FranchizePageShell theme={crew.theme} contentClassName="space-y-4" width="full">
        <SeasonStatsClient
          slug={resolvedSlug}
          crewName={crew.name}
          ownerTier={ownerTier}
          tokens={tokens}
        />
      </FranchizePageShell>
      {/* task154 iter3: secret birthday quest — stop 7/7, the last riddle
          before the gift (vip-bike crew only; Roman opens logged in) */}
      {slug === "vip-bike" && (
        <RomanQuestCake
          stop={7}
          riddle="Вот они, плоды общего дела — весь сезон до рубля. Остался последний шаг: прибавь к адресу сайта /gift/roman — и забери своё. Осталось нажать одну кнопку."
          nextHref="/gift/roman"
          nextLabel="Открыть подарок"
        />
      )}
      <CrewFooter crew={crew} />
    </main>
  );
}
