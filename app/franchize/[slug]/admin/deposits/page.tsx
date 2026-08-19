// /app/franchize/[slug]/admin/deposits/page.tsx
import { DepositsAdminClient } from "./DepositsAdminClient";
import { CrewHeader } from "../../../components/CrewHeader";
import { getFranchizeBySlug } from "../../../actions";
import { crewPaletteForSurface } from "../../../lib/theme";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyTelegramActorCookieValue, TELEGRAM_ACTOR_COOKIE } from "@/lib/telegram-actor-cookie";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DepositsAdminPage({ params }: Props) {
  const { slug } = await params;
  const { crew } = await getFranchizeBySlug(slug);
  const resolvedSlug = crew.slug || slug;
  const surface = crewPaletteForSurface(crew.theme);
  const activePath = `/franchize/${resolvedSlug}/admin/deposits`;

  // 2026-08-19 review: previously this admin page had NO server-side auth
  // gate. Any unauthenticated visitor could load it. The underlying API
  // now requires auth (deposit-list verifies the cookie + crew access), so
  // unauthenticated users would just see an empty page, but owners have
  // no expectation that the page itself is publicly accessible.
  //
  // Restrict to owner / co_owner / admin tier (matches shared verifyCrewAccess
  // semantics; replicated inline here because the page is a Server Component
  // and the SSR gate is a thin layer).
  const cookieStore = await cookies();
  const actorCookie = cookieStore.get(TELEGRAM_ACTOR_COOKIE)?.value;
  const callerUserId = verifyTelegramActorCookieValue(actorCookie);

  let canAccess = false;
  if (callerUserId) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", callerUserId)
      .maybeSingle();
    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", resolvedSlug)
      .maybeSingle();

    if (crewRow) {
      const isOwner = crewRow.owner_id === callerUserId || isAdmin;
      const { data: membership } = await supabaseAdmin
        .from("crew_members")
        .select("role, membership_status")
        .eq("crew_id", crewRow.id)
        .eq("user_id", callerUserId)
        .maybeSingle();
      const isCoOwner =
        membership?.membership_status === "active" &&
        ["co_owner", "admin"].includes(membership?.role || "");
      canAccess = Boolean(isOwner || isCoOwner);
    }
  }

  if (!canAccess) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={surface.page}>
        <div className="text-center p-8">
          <p className="text-2xl mb-2">🔒</p>
          <p className="text-sm font-semibold" style={{ color: surface.card.color }}>
            Доступ только для владельца, со-владельца или администратора
          </p>
          <p className="mt-1 text-xs" style={{ color: surface.card.borderColor }}>
            Откройте эту страницу через Telegram WebApp с соответствующими правами.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={surface.page}>
      <CrewHeader crew={crew} activePath={activePath} groupLinks={[]} items={[]} />
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--franchize-text-primary, inherit)" }}>
          🏥 Депозиты
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--franchize-text-secondary, inherit)" }}>
          Отслеживание депозитов: наличные, Тинькофф, Сбербанк
        </p>
        <DepositsAdminClient slug={resolvedSlug} />
      </div>
    </main>
  );
}
