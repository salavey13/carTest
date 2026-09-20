import type { Metadata } from "next";
import Link from "next/link";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { CommunityWallClient } from "./CommunityWallClient";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";
import { crewPaletteWithCssVars, readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Сообщество экипажа",
    sectionDescription: "Живая стена экипажа: посты райдеров, фото поездок, статистика аренды и комментарии.",
    pathSuffix: "/community",
  });
}

export default async function FranchizeCommunityPage(
  { params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
) {
  const { slug } = await params;
  const sp = await searchParams;
  // Deep-link landing (startapp=post_<id>_<slug> / wallp_<rental>_<slug> /
  // ride_<session>_<slug>):
  // id валидируем по форме uuid — всё остальное молча игнорируем.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const rawPost = typeof sp.post === "string" ? sp.post.trim() : "";
  const rawCompose = typeof sp.compose === "string" ? sp.compose.trim() : "";
  const rawRide = typeof sp.ride === "string" ? sp.ride.trim() : "";
  const highlightPostId = uuidRe.test(rawPost) ? rawPost : null;
  const composeRentalId = uuidRe.test(rawCompose) ? rawCompose : null;
  const composeRideId = uuidRe.test(rawRide) ? rawRide : null;
  // Meetup → wall interlink: поиск по заголовку meetup-точки (q ≤ 60 — тот же
  // cap, что у FeedInput в server actions).
  const rawQ = typeof sp.q === "string" ? sp.q.trim() : "";
  const initialQuery = rawQ.slice(0, 60) || null;
  // Spot check-in: id из каталога мототочек (валидация — на клиенте по каталогу).
  const rawSpot = typeof sp.spot === "string" ? sp.spot.trim() : "";
  const checkinSpotId = /^[a-z0-9-]{1,64}$/i.test(rawSpot) ? rawSpot.toLowerCase() : null;
  const { crew, items } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/community`;
  const surface = crewPaletteWithCssVars(crew.theme);
  const brandName = crew.header.brandName || crew.name || "Экипаж";

  // Use crew-specific telegram handle with fallback to bot username
  const crewTelegram = crew.contacts.telegram?.replace("@", "");
  const crewBotUsername = crew.contacts.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME;
  const telegramHref = crewTelegram
    ? `https://t.me/${crewTelegram}`
    : crewBotUsername
      ? `https://t.me/${crewBotUsername}`
      : "";
  const accentText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);

  const themeVars = {
    ["--community-accent" as string]: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
    ["--community-border" as string]: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
    ["--community-card" as string]: surface.subtleCard.backgroundColor,
    ["--community-base-soft" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase, 0.35),
    ["--community-card-soft" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard, 0.86),
    ["--community-card-faint" as string]: withAlpha(crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard, 0.54),
    ["--community-text" as string]: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
    ["--community-muted" as string]: crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary,
    ["--community-accent-text" as string]: crew.theme.isAuto
      ? readablePaletteTextOnColor(crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain, crew.theme.palettes?.dark || crew.theme.palettes?.light || crew.theme.palette)
      : accentText,
    color: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
  } as React.CSSProperties;

  return (
    <main className="min-h-screen" style={{ ...surface.page, ...themeVars }}>
      <CrewHeader crew={crew} activePath={activePath} sectionLinks={buildFranchizeIntentLinks(crewSlug, activePath)} items={items} />

      {/* compact intro — no legacy schedule/guide/partner filler, just the two live CTAs */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-20 md:pt-24">
        <section className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--community-accent)]">
              OnlyBike community
            </p>
            <h1 className="mt-2 font-orbitron text-3xl leading-tight md:text-5xl">
              Стена экипажа <span className="text-[var(--community-accent)]">{brandName}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-[var(--community-muted)]">
              Живая лента райдеров: посты с фото, статистика поездок из аренды и комментарии — как стена экипажа, только на всю ширину.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/franchize/${crewSlug}/map-riders`}
              className="rounded-full bg-[var(--community-accent)] px-5 py-3 text-sm font-semibold text-[var(--community-accent-text)] transition hover:brightness-110"
            >
              Открыть live-карту
            </Link>
            {telegramHref && (
              <a
                href={telegramHref}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--community-border)] px-5 py-3 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)]"
              >
                Написать экипажу
              </a>
            )}
          </div>
        </section>
      </div>

      {/* OnlyBike community wall — live feed: posts, photos, rental stats, comments.
          FULL PAGE WIDTH on purpose (no max-w wrapper): the wall is the page.
          Server actions verify the Telegram actor; anonymous visitors read-only. */}
      <CommunityWallClient
        slug={crewSlug}
        crewName={brandName}
        botUsername={crewBotUsername || (crewTelegram ? crewTelegram : null)}
        // Для share/deeplink-построек годится ТОЛЬКО настоящий бот:
        // t.me/<человек>/app?startapp=… — битая Mini App ссылка (boss v4).
        deeplinkBotUsername={crew.contacts.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || null}
        highlightPostId={highlightPostId}
        composeRentalId={composeRentalId}
        composeRideId={composeRideId}
        initialQuery={initialQuery}
        checkinSpotId={checkinSpotId}
      />

      <CrewFooter crew={crew} />
    </main>
  );
}
