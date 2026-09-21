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
import { supabaseAdmin } from "@/lib/supabase-server";
import type { WallPostView } from "@/app/franchize/lib/community-wall";
import { logger } from "@/lib/logger";
import { RiderProfileClient } from "./RiderProfileClient";

const RIDER_ID_RE = /^[0-9]{1,16}$/;
/** Scan cap for «in which crews did this rider post» (NN-crew scale). */
const RIDER_CREWS_SCAN_CAP = 400;
/** Total cap for the merged cross-crew feed on the profile. */
const RIDER_POSTS_MERGE_CAP = 30;

/** A wall post annotated with its home crew (for the «в экипаже X» chip). */
export type RiderWallPost = WallPostView & {
  viaCrewName: string | null;
  viaCrewSlug: string | null;
};

// Cross-crew fanout («combine all posts on all crews' walls from user»):
// the profile aggregates the rider's public posts from EVERY crew they
// posted in, not just the crew whose page is open. Walls are publicly
// readable, so this exposes nothing that isn't already public — it just
// spares the viewer from hopping between crews. Newest first, capped.
async function loadRiderPostsAcrossCrews(input: {
  riderId: string;
}): Promise<RiderWallPost[]> {
  const { riderId } = input;
  try {
    // 1. Distinct crews this rider has visible posts in (bounded scan).
    const { data: postCrewRows } = await supabaseAdmin
      .from("crew_posts")
      .select("crew_id")
      .eq("author_id", riderId)
      .eq("is_hidden", false)
      .limit(RIDER_CREWS_SCAN_CAP);
    const crewIds = [...new Set(((postCrewRows ?? []) as { crew_id: string }[]).map((r) => r.crew_id))];
    if (crewIds.length === 0) return [];

    // 2. Crew labels/slugs (only ones that still exist and have a slug).
    const { data: crewRows } = await supabaseAdmin
      .from("crews")
      .select("id, slug, name")
      .in("id", crewIds);
    const crews = (crewRows ?? []) as { id: string; slug: string | null; name: string | null }[];

    // 3. Pull the rider's page-1 feed per crew (the same public action the
    // wall uses — identical mapping/authz) and merge.
    const results = await Promise.all(
      crews.map(async (crew) => {
        if (!crew.slug) return [];
        const res = await getCommunityWallAction({ slug: crew.slug, authorId: riderId });
        if (!res.ok) return [];
        return res.posts
          .filter((p) => p.author.userId === riderId)
          .map<RiderWallPost>((p) => ({
            ...p,
            viaCrewName: crew.name ?? null,
            viaCrewSlug: crew.slug ?? null,
          }));
      }),
    );

    const merged = results.flat();
    // De-dupe (a post belongs to exactly one crew, but defensive) + newest first.
    const seen = new Set<string>();
    return merged
      .filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
      .slice(0, RIDER_POSTS_MERGE_CAP);
  } catch (error) {
    logger.warn("[rider-page] cross-crew posts load failed (non-fatal):", error);
    return [];
  }
}

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

  const [profileRes, posts] = await Promise.all([
    getRiderProfileAction({ slug: crewSlug, riderId: userId.trim() }),
    // «This rider's part of the wall» — across ALL crews they posted in,
    // merged newest-first (walls are publicly readable; nothing new leaks).
    loadRiderPostsAcrossCrews({ riderId: userId.trim() }),
  ]);

  if (!profileRes.ok) notFound();
  const profile: RiderProfileView = profileRes.profile;

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
