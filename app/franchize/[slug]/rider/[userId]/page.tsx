import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import { CrewFooter } from "@/app/franchize/components/CrewFooter";
import { CrewHeader } from "@/app/franchize/components/CrewHeader";
import { crewPaletteWithCssVars, readablePaletteTextOnColor, withAlpha } from "@/app/franchize/lib/theme";
import { buildFranchizeSectionMetadata } from "../../metadata";
import { getCommunityWallAction } from "@/app/franchize/server-actions/community-wall";
import { getRiderProfileAction, type RiderProfileView } from "@/app/franchize/server-actions/rider-profile";
import type { WallPostView } from "@/app/franchize/lib/community-wall";
import { RiderProfileClient } from "./RiderProfileClient";

const RIDER_ID_RE = /^[0-9]{1,16}$/;

interface RiderProfilePageProps {
  params: Promise<{ slug: string; userId: string }>;
}

export async function generateMetadata({ params }: RiderProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildFranchizeSectionMetadata(slug, {
    sectionTitle: "Профиль райдера",
    sectionDescription: "Публичный профиль райдера экипажа: статистика, бейджи, гараж и посты со стены.",
    pathSuffix: "/rider",
  });
}

export default async function RiderProfilePage({ params }: RiderProfilePageProps) {
  const { slug, userId } = await params;
  if (!RIDER_ID_RE.test(userId.trim())) notFound();

  const { crew, items } = await getFranchizeBySlug(slug);
  const crewSlug = crew.slug || slug;
  const activePath = `/franchize/${crewSlug}/rider/${userId}`;
  const surface = crewPaletteWithCssVars(crew.theme);
  const brandName = crew.header.brandName || crew.name || "Экипаж";

  // The same palette bridge the wall uses (--community-*) — the profile IS
  // part of the wall family, not a separate surface (consistency request:
  // «wall and map-riders should feel like 2 parts of one thing»).
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

  const [profileRes, wallRes] = await Promise.all([
    getRiderProfileAction({ slug: crewSlug, riderId: userId.trim() }),
    // «This rider's part of the wall»: their public posts (page 1). The
    // actor is resolved server-side from the signed cookie — the same two
    // identity paths as the wall itself.
    getCommunityWallAction({ slug: crewSlug, authorId: userId.trim() }),
  ]);

  if (!profileRes.ok) notFound();
  const profile: RiderProfileView = profileRes.profile;
  const posts: WallPostView[] = wallRes.ok ? wallRes.posts.filter((p) => p.author.userId === profile.rider.userId) : [];

  return (
    <main className="min-h-screen" style={{ ...surface.page, ...themeVars }}>
      <CrewHeader crew={crew} activePath={activePath} items={items} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-20 md:pt-24">
        <RiderProfileClient profile={profile} crewSlug={crewSlug} crewName={brandName} initialPosts={posts} />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/franchize/${crewSlug}/community`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--community-border)] px-5 py-2.5 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)]"
          >
            ← Вся стена экипажа
          </Link>
          {/* the trio stays one tap apart: wall · map · profile */}
          <Link
            href={`/franchize/${crewSlug}/map-riders`}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--community-border)] px-5 py-2.5 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)]"
          >
            Live-карта
          </Link>
        </div>
      </div>
      <CrewFooter crew={crew} />
    </main>
  );
}
