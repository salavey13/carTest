"use client";

// app/franchize/[slug]/community/CommunityWallClient.tsx
//
// ─────────────────────────────────────────────────────────────────────────────
// OnlyBike community wall — the live part of the /community page (wall v5,
// «Neon Garage» beauty pass). A VK-style wall for the crew and its riders:
//   • feed of posts (pinned first), stats-brag posts with a snapshot card;
//   • composer: free text + «Поделиться статистикой» + PHOTO attachments
//     (compressed client-side via lib/client-image-compress — the rental-page
//     pipeline — then re-compressed server-side by sharp) + bike «mentions»
//     from the crew catalogue (up to 3);
//   • photo grid per post + fullscreen lightbox with PINCH-ZOOM (mobile),
//     double-tap zoom, pan and swipe navigation;
//   • likes + one-level comments, staff moderation (hide) / author delete;
//   • the wall spans the FULL page width (no max-w wrapper) — page.tsx renders
//     it outside the legacy content container.
//
// Identity: server actions resolve the Telegram actor (signed cookie or
// HMAC-verified initData). Anonymous web visitors get a read-only wall with a
// locked composer. Styling rides on the --community-* CSS vars set by the
// page, so the wall inherits the crew theme automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BarChart3,
  Bike,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownRight,
  EyeOff,
  Heart,
  ImagePlus,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  PinOff,
  Search,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import {
  buildWallPostPreview,
  formatDateTimeRu,
  formatRelativeTimeRu,
  formatRub,
  hashtagKey,
  parseWallText,
  pluralRu,
  computeZoomOffset,
  zoomAtPoint,
  riderMilestoneBadge,
  toggleReactionOptimistic,
  WALL_BIKES_MAX,
  WALL_COMMENT_MAX_LEN,
  WALL_COMMENTS_FETCH_LIMIT,
  WALL_PHOTOS_MAX,
  WALL_POST_MAX_LEN,
  WALL_REACTIONS,
  type RentalStatsSnapshot,
  type WallBikeRefView,
  type WallPhotoView,
  type WallPostView,
  type WallViewerInfo,
} from "@/app/franchize/lib/community-wall";
import {
  addPostCommentAction,
  countNewWallPostsAction,
  createCommunityPostAction,
  deleteCommunityPostAction,
  getCommunityWallAction,
  getMyRentalStatsAction,
  getPostCommentsAction,
  getWallBikeOptionsAction,
  getWallPostAction,
  getWallRentalDraftAction,
  getWallRideDraftAction,
  getWallTrendingAction,
  hideCommunityCommentAction,
  hideCommunityPostAction,
  setPostPinnedAction,
  togglePostReactionAction,
  type WallBikeOption,
  type WallRentalDraft,
  type WallRideDraft,
  type WallTrendingTag,
} from "@/app/franchize/server-actions/community-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { reduceImageResolution } from "@/lib/client-image-compress";
import { buildSpotCheckinText, findMotoSpotById } from "@/lib/map-riders-spots";
import { buildTelegramAppLink, wallPostStartParam } from "@/lib/wall-deeplink";
import { WhoReactedModal } from "./WhoReactedModal";

/** A photo being attached in the composer (upload → staging → post). */
interface ComposerPhoto {
  /** Local blob URL for the preview (revoked on remove). */
  previewUrl: string;
  /** wallpix staging path once uploaded; null while uploading/failed. */
  path: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  uploading: boolean;
  failed: boolean;
}

/**
 * Portal to document.body. The wall section carries `backdrop-blur-xl`, which
 * per CSS spec turns it into the CONTAINING BLOCK for position:fixed
 * descendants — a plain `fixed inset-0` overlay inside it would anchor to the
 * (possibly 10k-px tall) section instead of the viewport. Everything that must
 * cover the real screen (lightbox, particle bursts) goes through here.
 */
function WallOverlayPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

interface CommunityWallClientProps {
  slug: string;
  crewName: string;
  /** Fallback for locked visitors: «открой через бота». */
  botUsername?: string | null;
  /** ТОЛЬКО бот (crew.contacts.telegramBotUsername || TELEGRAM_BOT_USERNAME):
   *  источник для share/deeplink построек. Человеческий @handle сюда попадать
   *  не должен — t.me/<human>/app?startapp=… это битая Mini App ссылка. */
  deeplinkBotUsername?: string | null;
  /** Deep-link: startapp=post_<id>_<slug> → выделить этот пост (и подгрузить,
   *  если он старый и не попал в первую страницу ленты). */
  highlightPostId?: string | null;
  /** Deep-link: startapp=wallp_<rentalId>_<slug> → открыть композер с готовым
   *  черновиком «поделиться поездкой» (аренда закрыта — уведомление экипажа). */
  composeRentalId?: string | null;
  /** Deep-link: startapp=ride_<sessionId>_<slug> → открыть композер с черновиком
   *  «поделиться заездом» из map-riders (interlink карта ↔ стена). */
  composeRideId?: string | null;
  /** Meetup → wall: предзаполнить поиск по заголовку точки встречи (?q=). */
  initialQuery?: string | null;
  /** Spot check-in (?spot=<id>): предзаполнить композер текстом про мототочку. */
  checkinSpotId?: string | null;
}

export function CommunityWallClient({ slug, crewName, botUsername, deeplinkBotUsername, highlightPostId, composeRentalId, composeRideId, initialQuery, checkinSpotId }: CommunityWallClientProps) {
  const [posts, setPosts] = useState<WallPostView[]>([]);
  const [viewer, setViewer] = useState<WallViewerInfo | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  // composer state
  const [text, setText] = useState("");
  const [shareStats, setShareStats] = useState(false);
  const [statsPreview, setStatsPreview] = useState<RentalStatsSnapshot | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerPhotos, setComposerPhotos] = useState<ComposerPhoto[]>([]);
  const [selectedBikes, setSelectedBikes] = useState<WallBikeOption[]>([]);
  const [bikePickerOpen, setBikePickerOpen] = useState(false);
  const [bikeOptions, setBikeOptions] = useState<WallBikeOption[] | null>(null);
  const [bikeOptionsLoading, setBikeOptionsLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Mirror of composerPhotos for synchronous cap checks (parallel uploads
  // mutate the ref synchronously so concurrent appends can never lose one).
  const composerPhotosRef = useRef<ComposerPhoto[]>([]);
  const setComposerPhotosSync = useCallback((next: ComposerPhoto[]) => {
    composerPhotosRef.current = next;
    setComposerPhotos(next);
  }, []);
  const appendComposerPhoto = useCallback((placeholder: ComposerPhoto) => {
    composerPhotosRef.current = [...composerPhotosRef.current, placeholder];
    setComposerPhotos(composerPhotosRef.current);
  }, []);

  // lightbox: which post's photos are open (index = photo within the post)
  const [lightbox, setLightbox] = useState<{ postId: string; index: number } | null>(null);
  // «Кому понравилось» (profile v1 / Chain #5): postId of the open modal.
  const [whoReacted, setWhoReacted] = useState<string | null>(null);

  // interactions
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  /** VK-style reply targets keyed by postId («Ответить {name}» chip above the input). */
  const [replyTargets, setReplyTargets] = useState<Record<string, { commentId: string; authorName: string } | null>>({});
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [sendingCommentFor, setSendingCommentFor] = useState<Record<string, boolean>>({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<Record<string, boolean>>({});
  const [wallNotice, setWallNotice] = useState<string | null>(null);

  const withInitData = useCallback(() => getTelegramInitData(), []);

  // discovery state (wall v3 step 3)
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // ?q= (meetup → wall interlink): предзаполняем поиск — лента сразу фильтруется.
  const [activeQuery, setActiveQuery] = useState<string | null>(initialQuery ?? null);
  const [searchDraft, setSearchDraft] = useState(initialQuery ?? "");
  const [trending, setTrending] = useState<{ tags: WallTrendingTag[]; weekPosts: number } | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const wallTopRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setFeedError(null);
    const res = await getCommunityWallAction({
      slug,
      initData: withInitData(),
      tag: activeTag ?? undefined,
      q: activeQuery ?? undefined,
    });
    if (res.ok) {
      setPosts(res.posts);
      setViewer(res.viewer);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } else {
      setFeedError(res.error);
    }
    setLoading(false);
  }, [slug, withInitData, activeTag, activeQuery]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const res = await getCommunityWallAction({
      slug,
      initData: withInitData(),
      before: nextBefore,
      tag: activeTag ?? undefined,
      q: activeQuery ?? undefined,
    });
    if (res.ok) {
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } else {
      setWallNotice(res.error);
    }
    setLoadingMore(false);
  }, [slug, nextBefore, loadingMore, withInitData, activeTag, activeQuery]);

  // trending strip (top tags of the week) — loaded once per mount
  useEffect(() => {
    void getWallTrendingAction({ slug }).then((res) => {
      if (res.ok) setTrending({ tags: res.tags, weekPosts: res.weekPosts });
    });
  }, [slug]);

  // debounced wall search: draft settles 400ms → query state (feed refetches)
  useEffect(() => {
    const t = setTimeout(() => {
      const q = searchDraft.trim();
      setActiveQuery(q.length >= 2 ? q : null);
    }, 400);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // «N новых постов» pill: cheap probe on an interval, paused in background tabs.
  // The probe ALSO refreshes live availability for the mentioned bikes so the
  // «в аренде до ~19:30» dots never go stale during a long session.
  const mentionIds = useMemo(
    () => [...new Set(posts.flatMap((p) => p.bikes.map((b) => b.bikeId)))].slice(0, 60),
    [posts],
  );
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const newest = posts.reduce((m, p) => (p.createdAt > m ? p.createdAt : m), posts[0]?.createdAt ?? "");
      if (!newest) return;
      const res = await countNewWallPostsAction({ slug, after: newest, bikeIds: mentionIds });
      if (res.ok && res.count > 0) setNewPostsCount(res.count);
      if (res.ok && res.bikesBusy.length > 0) {
        const busyById = new Map(res.bikesBusy.map((b) => [b.bikeId, b.busyUntilIso]));
        setPosts((prev) =>
          prev.map((p) =>
            p.bikes.length === 0
              ? p
              : {
                  ...p,
                  bikes: p.bikes.map((b) => {
                    const fresh = busyById.get(b.bikeId);
                    return fresh === undefined || fresh === b.busyUntilIso ? b : { ...b, busyUntilIso: fresh };
                  }),
                },
          ),
        );
      }
    }, 45000);
    return () => clearInterval(t);
  }, [posts, slug, mentionIds]);

  const jumpToNewPosts = useCallback(() => {
    setNewPostsCount(0);
    void loadFeed({ silent: true });
    wallTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loadFeed]);

  // Deep link: #post-<id> (из «Поделиться») или ?post=<id> (из startapp) →
  // скролл + подсветка. Если пост старый и его НЕТ в загруженной ленте —
  // добираем одним запросом (getWallPostAction) и вставляем сверху.
  const hashScrolledRef = useRef(false);
  const deepLinkPostFetchedRef = useRef(false);
  const pendingDeepLinkPostId = highlightPostId ?? null;
  // Пере-оружаемся при смене цели (in-place навигация на другой ?post=).
  useEffect(() => {
    hashScrolledRef.current = false;
    deepLinkPostFetchedRef.current = false;
  }, [pendingDeepLinkPostId]);
  useEffect(() => {
    if (loading || hashScrolledRef.current) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashPostId = hash.startsWith("#post-") ? hash.slice(6) : null;
    const targetPostId = hashPostId || pendingDeepLinkPostId;
    if (!targetPostId) return;
    const el = document.getElementById(`post-${targetPostId}`);
    if (!el) {
      // Пост не в ленте (старый пост) → один раз добираем его с сервера —
      // работает и для ?post= (startapp), и для #post- (веб-шара).
      if (!deepLinkPostFetchedRef.current && !activeTag && !activeQuery) {
        deepLinkPostFetchedRef.current = true;
        void getWallPostAction({ slug, postId: targetPostId }).then((res) => {
          if (res.ok) setPosts((prev) => (prev.some((p) => p.id === res.post.id) ? prev : [res.post, ...prev]));
        });
      }
      return;
    }
    hashScrolledRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[var(--community-accent)]");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-[var(--community-accent)]"), 2500);
    return () => clearTimeout(t);
  }, [loading, posts, pendingDeepLinkPostId, slug, activeTag, activeQuery]);

  // ── compose draft («поделиться поездкой» из уведомления о закрытии аренды) ──
  const [composeDraft, setComposeDraft] = useState<WallRentalDraft | null>(null);
  const [composeDismissed, setComposeDismissed] = useState(false);
  useEffect(() => {
    if (!composeRentalId) return;
    let cancelled = false;
    void getWallRentalDraftAction({ slug, rentalId: composeRentalId, initData: withInitData() }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        // Тихий композер — плохой UX: черновик не приехал, скажи почему.
        setWallNotice(res.error);
        return;
      }
      setComposeDraft(res.draft);
      // Текст — только если композер пустой (не затираем то, что человек пишет).
      setText((prev) => (prev.trim() ? prev : res.draft.autoText));
      if (res.draft.bikeId) {
        const bike = {
          bikeId: res.draft.bikeId,
          title: res.draft.bikeTitle,
          imageUrl: null as string | null,
        };
        setSelectedBikes((prev) => (prev.some((b) => b.bikeId === bike.bikeId) ? prev : [...prev, bike]));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeRentalId, slug]);

  // ── ride draft («поделиться заездом» из map-riders, interlink карта ↔ стена) ──
  const [rideDraft, setRideDraft] = useState<WallRideDraft | null>(null);
  const [rideDraftDismissed, setRideDraftDismissed] = useState(false);
  useEffect(() => {
    if (!composeRideId) return;
    let cancelled = false;
    void getWallRideDraftAction({ slug, sessionId: composeRideId, initData: withInitData() }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setWallNotice(res.error);
        return;
      }
      setRideDraft(res.draft);
      // Текст — только если композер пустой (не затираем то, что человек пишет).
      setText((prev) => (prev.trim() ? prev : res.draft.autoText));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeRideId, slug]);

  // ── spot check-in (?spot=<id> с попапа точки на карте) ───────────────────────
  // Текст — только в пустой композер; id валидируется по каталогу (иначе тихо
  // игнорируем: параметр недоверенный — пришёл из URL).
  const checkinSpot = findMotoSpotById(checkinSpotId);
  const [checkinDismissed, setCheckinDismissed] = useState(false);
  useEffect(() => {
    const spot = findMotoSpotById(checkinSpotId);
    if (!spot) return;
    setText((prev) => (prev.trim() ? prev : buildSpotCheckinText(spot)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinSpotId]);

  const applyTagFilter = useCallback((tag: string | null) => {
    setActiveTag((cur) => (tag !== null && cur === tag ? null : tag));
    setSearchDraft("");
  }, []);

  // ── composer: stats toggle ──────────────────────────────────────────────────

  const toggleShareStats = useCallback(async () => {
    const next = !shareStats;
    setShareStats(next);
    setComposerError(null);
    if (next && !statsPreview && !statsLoading) {
      setStatsLoading(true);
      const res = await getMyRentalStatsAction({ slug, initData: withInitData() });
      if (res.ok) {
        setStatsPreview(res.stats);
        if (!text.trim()) setText(res.autoText);
      } else {
        setComposerError(res.error);
        setShareStats(false);
      }
      setStatsLoading(false);
    }
  }, [shareStats, statsPreview, statsLoading, slug, withInitData, text]);

  // ── composer: photo attach (rental-page pipeline: compress → upload) ────────

  const addPhotoFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = [...files].filter((f) => f.type.startsWith("image/"));
      if (incoming.length === 0) return;
      setComposerError(null);

      const slotsLeft = WALL_PHOTOS_MAX - composerPhotosRef.current.length;
      if (slotsLeft <= 0) {
        setComposerError(`Максимум ${WALL_PHOTOS_MAX} фото на пост.`);
        return;
      }
      const accepted = incoming.slice(0, slotsLeft);
      if (incoming.length > slotsLeft) {
        setComposerError(`Максимум ${WALL_PHOTOS_MAX} фото на пост — лишние отброшены.`);
      }

      // Parallel uploads (per-file placeholder keeps object identity for the
      // state updates; the ref-guard above makes the cap race-free).
      const uploadOne = async (file: File) => {
        const placeholder: ComposerPhoto = {
          previewUrl: URL.createObjectURL(file),
          path: null,
          width: null,
          height: null,
          bytes: null,
          uploading: true,
          failed: false,
        };
        appendComposerPhoto(placeholder);

        try {
          // 1. Client-side compression — the same lib the rental page uses.
          // 1280px / q0.70: tighter than the rental gallery (wall v4 photo
          // budget is < 300 KB after the server's sharp pass, so sending the
          // server a 1600px blob just wastes mobile upload time).
          const blob = await reduceImageResolution(file, { maxSize: 1280, quality: 0.7 });
          const compressedFile = new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" });
          // swap the preview to the compressed variant (revoke the original
          // blob — a 10–25 MB source must not stay retained in the session)
          URL.revokeObjectURL(placeholder.previewUrl);
          placeholder.previewUrl = URL.createObjectURL(compressedFile);

          // 2. Upload to staging via the wall-photo-upload route (sharp on server).
          const form = new FormData();
          form.set("file", compressedFile);
          form.set("slug", slug);
          const initData = withInitData();
          if (initData) form.set("initData", initData);
          const res = await fetch("/api/franchize/wall-photo-upload", { method: "POST", body: form });
          const json = (await res.json().catch(() => null)) as
            | { success?: boolean; path?: string; width?: number; height?: number; bytes?: number; error?: string }
            | null;
          if (!res.ok || !json?.success || !json.path) {
            throw new Error(json?.error || "Не удалось загрузить фото.");
          }

          setComposerPhotosSync(
            composerPhotosRef.current.map((p) =>
              p === placeholder
                ? { ...placeholder, path: json.path!, width: json.width ?? null, height: json.height ?? null, bytes: json.bytes ?? null, uploading: false, failed: false }
                : p,
            ),
          );
        } catch (err) {
          setComposerPhotosSync(
            composerPhotosRef.current.map((p) => (p === placeholder ? { ...placeholder, uploading: false, failed: true } : p)),
          );
          setComposerError(err instanceof Error ? err.message : "Не удалось загрузить фото.");
        }
      };

      await Promise.all(accepted.map((file) => uploadOne(file)));
    },
    [slug, withInitData, setComposerPhotosSync, appendComposerPhoto],
  );

  const removeComposerPhoto = useCallback((target: ComposerPhoto) => {
    URL.revokeObjectURL(target.previewUrl);
    setComposerPhotosSync(composerPhotosRef.current.filter((p) => p !== target));
  }, [setComposerPhotosSync]);

  // ── composer: bike picker («прикрепить байк из каталога») ──────────────────

  const toggleBikePicker = useCallback(async () => {
    const next = !bikePickerOpen;
    setBikePickerOpen(next);
    setComposerError(null);
    if (next && bikeOptions === null && !bikeOptionsLoading) {
      setBikeOptionsLoading(true);
      const res = await getWallBikeOptionsAction({ slug });
      if (res.ok) setBikeOptions(res.bikes);
      else setComposerError(res.error);
      setBikeOptionsLoading(false);
    }
  }, [bikePickerOpen, bikeOptions, bikeOptionsLoading, slug]);

  const toggleBikeSelected = useCallback((bike: WallBikeOption) => {
    setSelectedBikes((prev) => {
      const isSelected = prev.some((b) => b.bikeId === bike.bikeId);
      if (isSelected) return prev.filter((b) => b.bikeId !== bike.bikeId);
      if (prev.length >= WALL_BIKES_MAX) {
        setComposerError(`Максимум ${WALL_BIKES_MAX} байка на пост.`);
        return prev;
      }
      return [...prev, bike];
    });
  }, []);

  const pendingUploads = composerPhotos.some((p) => p.uploading);
  const failedUploads = composerPhotos.filter((p) => p.failed).length;

  // ── publish ────────────────────────────────────────────────────────────────

  const submitPost = useCallback(async () => {
    if (posting) return;
    if (failedUploads > 0) {
      setComposerError("Часть фото не загрузилось — удали их и попробуй ещё раз.");
      return;
    }
    setPosting(true);
    setComposerError(null);
    const res = await createCommunityPostAction({
      slug,
      body: text.trim() || undefined,
      shareStats,
      // «Поделиться поездкой»: прикрепляем аренду ТОЛЬКО если это своя аренда
      // (сервер отдельно проверяет владельца — чужую не даст прицепить).
      rentalId: composeDraft?.canAttachRental ? composeDraft.rentalId : undefined,
      initData: withInitData(),
      photos: composerPhotos
        .filter((p) => p.path)
        .map((p) => ({ path: p.path, width: p.width, height: p.height, bytes: p.bytes })),
      bikes: selectedBikes.map((b) => b.bikeId),
    });
    if (res.ok) {
      // Insert after pinned posts (pinned block always stays on top).
      setPosts((prev) => {
        const firstRegular = prev.findIndex((p) => !p.isPinned);
        return firstRegular === -1
          ? [...prev, res.post]
          : [...prev.slice(0, firstRegular), res.post, ...prev.slice(firstRegular)];
      });
      setText("");
      setShareStats(false);
      setStatsPreview(null); // next stats post gets a FRESH server snapshot
      for (const p of composerPhotosRef.current) URL.revokeObjectURL(p.previewUrl);
      setComposerPhotosSync([]);
      setSelectedBikes([]);
      setBikePickerOpen(false);
      setComposeDraft(null);
      setComposeDismissed(false);
      setRideDraft(null);
      setRideDraftDismissed(false);
    } else {
      setComposerError(res.error);
    }
    setPosting(false);
  }, [posting, failedUploads, slug, text, shareStats, withInitData, composerPhotos, selectedBikes, composeDraft, setComposerPhotosSync]);

  // ── likes / comments / moderation ──────────────────────────────────────────

  /** VK semantics: quick tap = ❤️ (or your current emoji toggles off); the
   *  picker (long-press / hover) sets any of the six. Optimistic first, DB
   *  truth after the round trip, rollback + notice on failure. */
  const toggleReaction = useCallback(async (post: WallPostView, emoji: string) => {
    if (pendingLikes.has(post.id)) return;
    if (!viewer?.userId) {
      setWallNotice("Реакции доступны из Telegram-бота экипажа.");
      return;
    }
    setPendingLikes((prev) => new Set(prev).add(post.id));
    const prevSnapshot = { counts: post.reactionCounts, total: post.likeCount, mine: post.viewerReaction };
    const optimistic = toggleReactionOptimistic(post.reactionCounts, post.likeCount, post.viewerReaction, emoji);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, reactionCounts: optimistic.counts, likeCount: optimistic.total, viewerReaction: optimistic.next }
          : p,
      ),
    );
    const res = await togglePostReactionAction({ postId: post.id, emoji, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, viewerReaction: res.reaction, likeCount: res.likeCount, reactionCounts: res.reactionCounts }
            : p,
        ),
      );
    } else {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, reactionCounts: prevSnapshot.counts, likeCount: prevSnapshot.total, viewerReaction: prevSnapshot.mine }
            : p,
        ),
      );
      setWallNotice(res.error);
    }
    setPendingLikes((prev) => {
      const next = new Set(prev);
      next.delete(post.id);
      return next;
    });
  }, [pendingLikes, viewer, withInitData]);

  const toggleComments = useCallback(async (post: WallPostView) => {
    const isExpanded = expanded.has(post.id);
    if (isExpanded) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
      return;
    }
    setExpanded((prev) => new Set(prev).add(post.id));
    // The feed ships only the newest-2 preview — fetch the full history once.
    if (post.comments.length < post.commentCount && !loadingCommentsFor[post.id]) {
      setLoadingCommentsFor((prev) => ({ ...prev, [post.id]: true }));
      const res = await getPostCommentsAction({ postId: post.id, initData: withInitData() });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, comments: res.comments } : p)));
      } else {
        setWallNotice(res.error);
      }
      setLoadingCommentsFor((prev) => ({ ...prev, [post.id]: false }));
    }
  }, [expanded, loadingCommentsFor, withInitData]);

  const submitComment = useCallback(async (post: WallPostView) => {
    const draft = (commentDrafts[post.id] ?? "").trim();
    if (!draft || sendingCommentFor[post.id]) return;
    if (!viewer?.userId) {
      setWallNotice("Комментировать можно из Telegram-бота экипажа.");
      return;
    }
    const replyTarget = replyTargets[post.id] ?? null;
    setSendingCommentFor((prev) => ({ ...prev, [post.id]: true }));
    const res = await addPostCommentAction({
      postId: post.id,
      body: draft,
      replyTo: replyTarget?.commentId,
      initData: withInitData(),
    });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, comments: [...p.comments, res.comment], commentCount: res.commentCount } : p,
        ),
      );
      setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
      setReplyTargets((prev) => ({ ...prev, [post.id]: null }));
      setExpanded((prev) => new Set(prev).add(post.id));
    } else {
      setWallNotice(res.error);
    }
    setSendingCommentFor((prev) => ({ ...prev, [post.id]: false }));
  }, [commentDrafts, replyTargets, sendingCommentFor, viewer, withInitData]);

  const moderatePost = useCallback(async (post: WallPostView, hide: boolean) => {
    const res = await hideCommunityPostAction({ postId: post.id, hide, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setWallNotice(hide ? "Пост скрыт из ленты." : null);
    } else {
      setWallNotice(res.error);
    }
  }, [withInitData]);

  const deletePost = useCallback(async (post: WallPostView) => {
    if (!window.confirm("Удалить пост безвозвратно?")) return;
    const res = await deleteCommunityPostAction({ postId: post.id, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setLightbox((cur) => (cur && cur.postId === post.id ? null : cur));
    } else {
      setWallNotice(res.error);
    }
  }, [withInitData]);

  const togglePin = useCallback(async (post: WallPostView) => {
    const res = await setPostPinnedAction({ postId: post.id, pinned: !post.isPinned, initData: withInitData() });
    if (res.ok) {
      // Pinned block reorders the feed — silent refetch keeps scroll & state.
      void loadFeed({ silent: true });
    } else {
      setWallNotice(res.error);
    }
  }, [withInitData, loadFeed]);

  const hideComment = useCallback(async (post: WallPostView, commentId: string) => {
    const res = await hideCommunityCommentAction({ commentId, hide: true, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, comments: p.comments.filter((c) => c.id !== commentId), commentCount: Math.max(p.commentCount - 1, 0) }
            : p,
        ),
      );
    } else {
      setWallNotice(res.error);
    }
  }, [withInitData]);

  const canModerate = !!viewer?.isCrewStaff;
  const isAnonymous = !viewer?.userId;

  const lightboxPost = lightbox ? posts.find((p) => p.id === lightbox.postId) ?? null : null;

  return (
    <section
      className="cw-scene cw-neon-top w-full border-y border-[var(--community-border)] bg-[var(--community-card-soft)] backdrop-blur-xl"
      aria-label="Стена сообщества экипажа"
    >
      {/* ambient garage atmosphere — decorative, never interactive */}
      <div className="cw-aurora" aria-hidden="true" />
      <div className="cw-grain" aria-hidden="true" />

      {/* header */}
      <div className="cw-above flex flex-wrap items-center justify-between gap-3 border-b border-[var(--community-border)] px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10">
            <BarChart3 className="h-5 w-5 text-[var(--community-accent)]" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 font-orbitron text-xl md:text-2xl text-[var(--community-text)]">
              Стена экипажа
              <span className="cw-live-dot" aria-hidden="true" />
            </h2>
            {trending && trending.weekPosts > 0 && (
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--community-muted)] opacity-80">
                {trending.weekPosts} {pluralRu(trending.weekPosts, ["пост", "поста", "постов"])} за неделю — экипаж живой
              </p>
            )}
          </div>
        </div>
        {/* Profile v1: signed-in riders get a one-tap bridge to their public
            profile; anonymous visitors keep the plain community caption. */}
        {viewer?.userId ? (
          <Link
            href={`/franchize/${slug}/rider/${viewer.userId}`}
            className="cw-press inline-flex min-h-[36px] items-center gap-2 rounded-full border border-[var(--community-border)] bg-[var(--community-card)] px-3.5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--community-muted)] transition hover:border-[var(--community-accent)] hover:text-[var(--community-text)]"
          >
            Мой профиль
            <span aria-hidden>→</span>
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--community-muted)] opacity-70">
            OnlyBike community
          </p>
        )}
      </div>

      <div className="cw-above flex flex-col gap-5 px-3 py-5 sm:px-4 md:px-8 md:py-6">
        {wallNotice && (
          <button
            type="button"
            onClick={() => setWallNotice(null)}
            className="cw-press rounded-2xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 px-4 py-2 text-left text-sm text-[var(--community-accent)]"
          >
            {wallNotice} — нажми, чтобы скрыть
          </button>
        )}

        {/* discovery bar (wall v3 step 3): search, trending, filters, pill */}
        <div ref={wallTopRef} className="scroll-mt-4">
          {newPostsCount > 0 && (
            <button
              type="button"
              onClick={jumpToNewPosts}
              className="cw-newpill cw-press mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--community-accent)]/50 bg-[var(--community-accent)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--community-accent)] transition hover:bg-[var(--community-accent)]/20"
            >
              <ChevronUp className="h-4 w-4" />
              {newPostsCount} {pluralRu(newPostsCount, ["новый пост", "новых поста", "новых постов"])} — показать
            </button>
          )}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--community-muted)]" />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value.slice(0, 60))}
                placeholder="Поиск по стене…"
                aria-label="Поиск по стене"
                className="w-full min-h-[44px] rounded-full border border-[var(--community-border)] bg-transparent py-2 pl-9 pr-8 text-sm text-[var(--community-text)] outline-none placeholder:text-[var(--community-muted)] focus:border-[var(--community-accent)] focus:ring-2 focus:ring-[var(--community-accent)]/25"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => setSearchDraft("")}
                  aria-label="Очистить поиск"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--community-muted)] transition hover:text-[var(--community-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {trending && (trending.tags.length > 0 || trending.weekPosts > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {trending.weekPosts > 0 && (
                  <span className="rounded-full border border-[var(--community-border)] px-2.5 py-1 text-[11px] text-[var(--community-muted)]">
                    {trending.weekPosts} {pluralRu(trending.weekPosts, ["пост", "поста", "постов"])} за неделю
                  </span>
                )}
                {trending.tags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => applyTagFilter(tag)}
                    aria-pressed={activeTag === tag}
                    className={`cw-press rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      activeTag === tag
                        ? "border-[var(--community-accent)] bg-[var(--community-accent)]/15 text-[var(--community-accent)] shadow-[0_0_14px_-4px_var(--community-accent)]"
                        : "border-[var(--community-border)] text-[var(--community-muted)] hover:border-[var(--community-accent)] hover:text-[var(--community-accent)]"
                    }`}
                  >
                    #{tag} · {count}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(activeTag || activeQuery) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--community-muted)]">
              <span>Фильтр:</span>
              {activeTag && (
                <span className="flex items-center gap-1 rounded-full border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 py-1 pl-2 pr-1 font-semibold text-[var(--community-accent)]">
                  #{activeTag}
                  <button
                    type="button"
                    onClick={() => applyTagFilter(null)}
                    aria-label="Убрать фильтр по тегу"
                    className="rounded-full p-0.5 transition hover:bg-[var(--community-accent)]/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {activeQuery && (
                <span className="flex items-center gap-1 rounded-full border border-[var(--community-border)] py-1 pl-2 pr-1 text-[var(--community-text)]">
                  «{activeQuery}»
                  <button
                    type="button"
                    onClick={() => setSearchDraft("")}
                    aria-label="Убрать поиск"
                    className="rounded-full p-0.5 transition hover:bg-[var(--community-accent)]/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* composer / locked state */}
        {isAnonymous ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[var(--community-border)] bg-[var(--community-card-faint)] p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--community-accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--community-text)]">
                  Читать может кто угодно, писать — райдеры из Telegram
                </p>
                <p className="mt-1 text-sm text-[var(--community-muted)]">
                  Открой эту страницу через бота экипажа — и публикуй посты с фото, хвастайся статистикой поездок, комментируй.
                </p>
              </div>
            </div>
            {botUsername ? (
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full bg-[var(--community-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--community-accent-text)] transition hover:brightness-110"
              >
                Открыть в Telegram
              </a>
            ) : null}
          </div>
        ) : (
          <div className="cw-composer rounded-2xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-4">
            {/* compose-draft banner: «поделиться поездкой» из уведомления о закрытии */}
            {composeDraft && !composeDismissed && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--community-accent)]">
                  🏁 Поездка прикреплена: {composeDraft.bikeTitle}
                  {composeDraft.km ? ` · ${composeDraft.km} км` : ""}
                  {composeDraft.canAttachRental ? "" : " (текст — твой, аренда чужая)"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setComposeDraft(null);
                    setComposeDismissed(true);
                  }}
                  aria-label="Убрать черновик поездки"
                  className="ml-auto rounded-full p-1 transition hover:bg-[var(--community-accent)]/20"
                >
                  <X className="h-3.5 w-3.5 text-[var(--community-accent)]" />
                </button>
              </div>
            )}
            {/* ride-draft banner: «поделиться заездом» из map-riders (interlink) */}
            {rideDraft && !rideDraftDismissed && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--community-accent)]">
                  🗺 Заезд подхвачен: {rideDraft.rideName?.trim() || "без названия"}
                  {rideDraft.distanceKm && rideDraft.distanceKm > 0 ? ` · ${Math.round(rideDraft.distanceKm * 10) / 10} км` : ""}
                  {rideDraft.maxSpeedKmh && rideDraft.maxSpeedKmh > 0 ? ` · до ${Math.round(rideDraft.maxSpeedKmh)} км/ч` : ""}
                  {" — статистика уже в тексте"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRideDraft(null);
                    setRideDraftDismissed(true);
                  }}
                  aria-label="Убрать черновик заезда"
                  className="ml-auto rounded-full p-1 transition hover:bg-[var(--community-accent)]/20"
                >
                  <X className="h-3.5 w-3.5 text-[var(--community-accent)]" />
                </button>
              </div>
            )}
            {/* check-in banner: «отметился в мототочке» (с попапа карты) */}
            {checkinSpot && !checkinDismissed && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--community-accent)]">
                  📍 Отметился: {checkinSpot.name} — {checkinSpot.address}
                </span>
                <button
                  type="button"
                  onClick={() => setCheckinDismissed(true)}
                  aria-label="Скрыть подсказку о точке"
                  className="ml-auto rounded-full p-1 transition hover:bg-[var(--community-accent)]/20"
                >
                  <X className="h-3.5 w-3.5 text-[var(--community-accent)]" />
                </button>
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, WALL_POST_MAX_LEN))}
              placeholder={`Что нового, райдер? Расскажи про последний заезд…`}
              rows={3}
              className="w-full resize-y rounded-xl border border-[var(--community-border)] bg-transparent p-3 text-sm text-[var(--community-text)] outline-none placeholder:text-[var(--community-muted)] focus:border-[var(--community-accent)]"
            />

            {/* photo previews */}
            {composerPhotos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {composerPhotos.map((photo, i) => (
                  <div
                    key={`${photo.previewUrl}-${i}`}
                    className="group relative h-20 w-20 overflow-hidden rounded-xl border border-[var(--community-border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img src={photo.previewUrl} alt={`Фото ${i + 1}`} className="h-full w-full object-cover" />
                    {photo.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                    {photo.failed && (
                      <div className="absolute inset-x-0 bottom-0 bg-red-500/80 px-1 py-0.5 text-center text-[10px] text-white">
                        ошибка
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeComposerPhoto(photo)}
                      disabled={photo.uploading}
                      aria-label={`Убрать фото ${i + 1}`}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80 disabled:opacity-40"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {composerPhotos.length < WALL_PHOTOS_MAX && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--community-border)] text-[var(--community-muted)] transition hover:border-[var(--community-accent)] hover:text-[var(--community-accent)]"
                    aria-label="Добавить ещё фото"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">{composerPhotos.length}/{WALL_PHOTOS_MAX}</span>
                  </button>
                )}
              </div>
            )}

            {shareStats && (
              <StatsPreviewCard stats={statsPreview} loading={statsLoading} />
            )}

            {/* bike picker */}
            {bikePickerOpen && (
              <div className="mt-3 rounded-xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--community-accent)]">
                    <Bike className="h-3.5 w-3.5" /> прикрепить байк из каталога
                  </p>
                  <button
                    type="button"
                    onClick={() => setBikePickerOpen(false)}
                    aria-label="Закрыть выбор байков"
                    className="rounded-full p-1 text-[var(--community-muted)] transition hover:text-[var(--community-text)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {bikeOptionsLoading ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--community-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Загружаем каталог…
                  </p>
                ) : (bikeOptions ?? []).length === 0 ? (
                  <p className="text-sm text-[var(--community-muted)]">В каталоге экипажа пока нет байков.</p>
                ) : (
                  <>
                    {(bikeOptions ?? []).length >= 60 && (
                      <p className="mb-1.5 text-[11px] text-[var(--community-muted)] opacity-70">
                        Показаны первые 60 байков каталога.
                      </p>
                    )}
                    <div className="grid max-h-52 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                    {(bikeOptions ?? []).map((bike) => {
                      const isSelected = selectedBikes.some((b) => b.bikeId === bike.bikeId);
                      return (
                        <button
                          key={bike.bikeId}
                          type="button"
                          onClick={() => toggleBikeSelected(bike)}
                          aria-pressed={isSelected}
                          className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                            isSelected
                              ? "border-[var(--community-accent)] bg-[var(--community-accent)]/10"
                              : "border-[var(--community-border)] hover:border-[var(--community-accent)]/50"
                          }`}
                        >
                          {bike.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- crew-managed bike photos live on arbitrary hosts
                            <img src={bike.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--community-accent)]/10">
                              <Bike className="h-4 w-4 text-[var(--community-accent)]" />
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--community-text)]">
                            {bike.title}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[var(--community-accent)]">✓</span>
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* selected bikes chips */}
            {selectedBikes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedBikes.map((bike) => (
                  <span
                    key={bike.bikeId}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 py-1 pl-2 pr-1 text-xs text-[var(--community-accent)]"
                  >
                    <Bike className="h-3.5 w-3.5" />
                    {bike.title}
                    <button
                      type="button"
                      onClick={() => toggleBikeSelected(bike)}
                      aria-label={`Убрать ${bike.title}`}
                      className="rounded-full p-0.5 transition hover:bg-[var(--community-accent)]/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void addPhotoFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={composerPhotos.length >= WALL_PHOTOS_MAX}
                  title={`Фото (до ${WALL_PHOTOS_MAX})`}
                  aria-label="Прикрепить фото"
                  className="cw-press flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--community-border)] px-3.5 text-xs font-semibold text-[var(--community-muted)] transition hover:border-[var(--community-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  Фото
                </button>
                <button
                  type="button"
                  onClick={() => void toggleBikePicker()}
                  disabled={selectedBikes.length >= WALL_BIKES_MAX && !bikePickerOpen}
                  title="Прикрепить байк из каталога"
                  aria-label="Прикрепить байк из каталога"
                  aria-expanded={bikePickerOpen}
                  className={`cw-press flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    bikePickerOpen || selectedBikes.length > 0
                      ? "border-[var(--community-accent)] bg-[var(--community-accent)]/15 text-[var(--community-accent)]"
                      : "border-[var(--community-border)] text-[var(--community-muted)] hover:border-[var(--community-accent)]"
                  }`}
                >
                  <Bike className="h-4 w-4" />
                  Байк
                </button>
                <button
                  type="button"
                  onClick={() => void toggleShareStats()}
                  className={`cw-press flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition ${
                    shareStats
                      ? "border-[var(--community-accent)] bg-[var(--community-accent)]/15 text-[var(--community-accent)]"
                      : "border-[var(--community-border)] text-[var(--community-muted)] hover:border-[var(--community-accent)]"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  {statsLoading ? "Считаем поездки…" : "Статистика"}
                </button>
                <span className="text-xs text-[var(--community-muted)] opacity-70">
                  {text.length} / {WALL_POST_MAX_LEN}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void submitPost()}
                disabled={
                  posting ||
                  pendingUploads ||
                  (!text.trim() && !shareStats && composerPhotos.length === 0 && selectedBikes.length === 0)
                }
                className="cw-press flex items-center gap-2 rounded-full bg-[var(--community-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--community-accent-text)] shadow-[0_8px_26px_-10px_var(--community-accent)] transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {pendingUploads ? "Загружаем фото…" : "Опубликовать"}
              </button>
            </div>
            {composerError && (
              <p className="mt-2 text-sm text-red-400">{composerError}</p>
            )}
          </div>
        )}

        {/* feed */}
        {loading ? (
          <WallSkeleton />
        ) : feedError ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            {feedError}
            <button type="button" onClick={() => void loadFeed()} className="ml-2 underline">
              Повторить
            </button>
          </div>
        ) : posts.length === 0 ? (
          activeTag || activeQuery ? (
            <div className="rounded-2xl border border-dashed border-[var(--community-border)] bg-[var(--community-card-faint)] p-8 text-center">
              <span className="cw-empty-icon">
                <Search className="h-8 w-8 text-[var(--community-muted)]" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--community-text)]">Ничего не нашлось.</p>
              <p className="mt-1 text-sm text-[var(--community-muted)]">
                Попробуй другой запрос или убери фильтр — и стена покажет всё подряд.
              </p>
              <button
                type="button"
                onClick={() => {
                  applyTagFilter(null);
                  setSearchDraft("");
                }}
                className="mt-3 rounded-full border border-[var(--community-accent)]/50 px-4 py-1.5 text-xs font-semibold text-[var(--community-accent)] transition hover:bg-[var(--community-accent)]/10"
              >
                Показать всю стену
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--community-border)] bg-[var(--community-card-faint)] p-8 text-center">
              <span className="cw-empty-icon">
                <Bike className="h-8 w-8 text-[var(--community-accent)]" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--community-text)]">
                Стена экипажа {crewName} пока пустая — будь первым!
              </p>
              <p className="mt-1 text-sm text-[var(--community-muted)]">
                Расскажи про свой первый заезд, прикрепи фото или поделись статистикой поездок.
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post, i) => (
              <PostCard
                key={post.id}
                index={i}
                post={post}
                slug={slug}
                viewer={viewer}
                canModerate={canModerate}
                expanded={expanded.has(post.id)}
                commentsLoading={!!loadingCommentsFor[post.id]}
                draft={commentDrafts[post.id] ?? ""}
                sendingComment={!!sendingCommentFor[post.id]}
                likePending={pendingLikes.has(post.id)}
                replyTarget={replyTargets[post.id] ?? null}
                onStartReply={(commentId, authorName) =>
                  setReplyTargets((prev) => ({ ...prev, [post.id]: { commentId, authorName } }))
                }
                onCancelReply={() => setReplyTargets((prev) => ({ ...prev, [post.id]: null }))}
                onToggleReaction={(emoji) => void toggleReaction(post, emoji)}
                onToggleComments={() => void toggleComments(post)}
                onTogglePin={() => void togglePin(post)}
                onHashtag={(tag) => applyTagFilter(tag)}
                onDraftChange={(v) => setCommentDrafts((prev) => ({ ...prev, [post.id]: v }))}
                onSubmitComment={() => void submitComment(post)}
                onHide={(hide) => void moderatePost(post, hide)}
                onDelete={() => void deletePost(post)}
                onHideComment={(commentId) => void hideComment(post, commentId)}
                onOpenPhoto={(index) => setLightbox({ postId: post.id, index })}
                onOpenReactions={() => setWhoReacted(post.id)}
                deeplinkBotUsername={deeplinkBotUsername}
              />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="cw-press mx-auto flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--community-border)] px-6 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)] disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Показать ещё
          </button>
        )}
      </div>

      {/* fullscreen photo viewer with pinch-zoom — PORTALED: the section's
          backdrop-blur would otherwise become its containing block and the
          «fixed» overlay would anchor to the section, not the viewport */}
      {lightboxPost && lightbox && lightboxPost.photos.length > 0 && (
        <WallOverlayPortal>
          <PhotoLightbox
            photos={lightboxPost.photos}
            index={Math.min(lightbox.index, lightboxPost.photos.length - 1)}
            onClose={() => setLightbox(null)}
            onIndexChange={(index) => setLightbox({ postId: lightboxPost.id, index })}
          />
        </WallOverlayPortal>
      )}

      {/* «Кому понравилось» (profile v1): portaled for the same
          containing-block reason as the photo lightbox above. */}
      {whoReacted && (
        <WallOverlayPortal>
          <WhoReactedModal slug={slug} postId={whoReacted} onClose={() => setWhoReacted(null)} />
        </WallOverlayPortal>
      )}
    </section>
  );
}

// ── subcomponents ────────────────────────────────────────────────────────────

function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "🏔";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string | null; size?: number }) {
  const initials = useMemo(() => initialsOf(name), [name]);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary Telegram CDN hosts
      <img
        src={url}
        alt={name ?? "Аватар"}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full border border-[var(--community-border)] object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/15 text-xs font-bold text-[var(--community-accent)]"
    >
      {initials}
    </div>
  );
}

/** Shimmer skeleton of the feed — replaces the bare spinner (wall v5). */
function WallSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="cw-card p-4 md:p-5">
          <div className="flex items-center gap-3">
            <div className="cw-skel h-10 w-10 shrink-0 !rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="cw-skel h-3.5 w-32" />
              <div className="cw-skel h-2.5 w-20" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="cw-skel h-3 w-full" />
            <div className="cw-skel h-3 w-11/12" />
            <div className="cw-skel h-3 w-2/3" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1.5">
            <div className="cw-skel aspect-square !rounded-xl" />
            <div className="cw-skel aspect-square !rounded-xl" />
            <div className="cw-skel aspect-square !rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsPreviewCard({ stats, loading }: { stats: RentalStatsSnapshot | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--community-border)] p-3 text-sm text-[var(--community-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Собираем твою статистику поездок…
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-[var(--community-accent)]/30 bg-[var(--community-accent)]/5 p-3">
      <StatsGrid stats={stats} compact />
    </div>
  );
}


/**
 * rAF odometer (v5): eases 0→target once `run` turns true — stat numbers
 * count up as the dashboard scrolls into view. Honours prefers-reduced-motion
 * (jumps straight to the target) and cancels the frame on cleanup.
 */
function useCountUp(target: number, run: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, durationMs]);
  return run ? value : 0;
}

/** True once the element has been ≥35% visible (fires once, then disconnects). */
function useInViewOnce(): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true); // ancient WebView — show the numbers immediately
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return [ref, inView];
}

/**
 * «Спидометр» (v5 special sauce) — hours in the saddle drawn as a neon gauge
 * arc (scale 0–100 ч, capped with «+»). The arc draws itself in via the CSS
 * cw-gauge animation; the number counts up with the shared rAF odometer.
 */
function SaddleGauge({ hours, run }: { hours: number; run: boolean }) {
  const pct = Math.max(0, Math.min(1, hours / 100));
  const shown = useCountUp(Math.min(hours, 100), run, 1100);
  return (
    <div className="cw-tick mb-3 flex items-center gap-4">
      <svg
        viewBox="0 0 120 68"
        className="h-[68px] w-[120px] shrink-0"
        role="img"
        aria-label={`Часов в седле: ${shown}${hours >= 100 ? "+" : ""}`}
      >
        {/* track */}
        <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="var(--community-border)" strokeWidth="8" strokeLinecap="round" opacity="0.45" />
        {/* accent arc — pathLength=100 makes dashoffset math percentages */}
        <path
          d="M 12 60 A 48 48 0 0 1 108 60"
          fill="none"
          stroke="var(--community-accent)"
          strokeWidth="8"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - pct * 100}
          className="cw-gauge-arc"
          style={{ "--cw-gauge-len": 100 } as React.CSSProperties}
        />
      </svg>
      <div>
        <p className="font-orbitron text-2xl tabular-nums text-[var(--community-accent)]">
          {shown}
          {hours >= 100 ? "+" : ""}
        </p>
        <p className="text-xs text-[var(--community-muted)]">часов в седле всего</p>
      </div>
    </div>
  );
}

function StatsGrid({ stats, compact = false }: { stats: RentalStatsSnapshot; compact?: boolean }) {
  // dashboard comes alive when it scrolls into view (v5 odometers)
  const [rootRef, inView] = useInViewOnce();

  const rides = useCountUp(stats.ridesCount, inView);
  const hours = useCountUp(stats.hoursRented, inView);
  const spent = useCountUp(Math.round(stats.totalSpent), inView);
  const bikes = useCountUp(stats.bikesUsed, inView);

  const cells: { value: string; label: string }[] = [
    { value: String(rides), label: pluralRu(stats.ridesCount, ["поездка", "поездки", "поездок"]) },
    { value: String(hours), label: pluralRu(stats.hoursRented, ["час в седле", "часа в седле", "часов в седле"]) },
    { value: formatRub(spent), label: "потрачено" },
    { value: String(bikes), label: pluralRu(stats.bikesUsed, ["байк", "байка", "байков"]) },
  ];
  return (
    <div ref={rootRef}>
      {!compact && <SaddleGauge hours={stats.hoursRented} run={inView} />}
      <div className={`grid gap-2 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-3 text-center">
            <p className="font-orbitron text-lg tabular-nums text-[var(--community-accent)] md:text-xl">{c.value}</p>
            <p className="mt-1 text-xs text-[var(--community-muted)]">{c.label}</p>
          </div>
        ))}
      </div>
      {stats.bikes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.bikes.map((b) => (
            <span
              key={b.vehicleId}
              className="rounded-full border border-[var(--community-border)] px-2.5 py-1 text-xs text-[var(--community-muted)]"
            >
              {b.title} × {b.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── photo grid (v5 mosaic: 1 → cinematic, 2 → diptych, 3 → hero + stack,
//    4+ → 2×2 with «+N» tile — VK/IG habits, thumbs stay ≥44px) ───────────────

function PostPhotoGrid({ photos, onOpen }: { photos: WallPhotoView[]; onOpen: (index: number) => void }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    const p = photos[0];
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="cw-photo block w-full"
          aria-label="Открыть фото"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
          <img
            src={p.url}
            alt="Фото поста"
            loading="lazy"
            className="mx-auto max-h-[560px] w-full object-cover"
          />
          <span className="cw-photo-veil" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  const layout =
    photos.length === 2
      ? "grid-cols-2 aspect-[4/3]"
      : photos.length === 3
        ? "grid-cols-2 grid-rows-2 aspect-[4/3]"
        : "grid-cols-2 aspect-square";
  return (
    <div className={`mt-3 grid gap-1.5 ${layout}`}>
      {shown.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(i)}
          className={`cw-photo h-full w-full ${photos.length === 3 && i === 0 ? "row-span-2" : ""}`}
          aria-label={`Открыть фото ${i + 1}${extra > 0 && i === 3 ? ` (ещё ${extra})` : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
          <img src={p.url} alt={`Фото ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          <span className="cw-photo-veil" aria-hidden="true" />
          {i === 3 && extra > 0 && (
            <span className="cw-more-tile absolute inset-0 flex items-center justify-center text-xl font-bold text-white">
              +{extra}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── bike mention chips on a post ─────────────────────────────────────────────

const RU_MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** «в аренде до ~19:30» (same day) or «в аренде до 12 сен» (later). */
function formatBusyUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "в аренде";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) {
    return `в аренде до ~${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `в аренде до ${d.getDate()} ${RU_MONTHS_SHORT[d.getMonth()]}`;
}

function PostBikeChips({ bikes, slug }: { bikes: WallBikeRefView[]; slug: string }) {
  if (bikes.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {bikes.map((bike) => (
        <Link
          key={bike.bikeId}
          href={`/franchize/${slug}/catalog`}
          title={`Открыть каталог — ${bike.title}`}
          className="flex items-center gap-2 rounded-full border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 py-1 pl-1 pr-3 text-xs font-semibold text-[var(--community-accent)] transition hover:bg-[var(--community-accent)]/20 cw-press"
        >
          {bike.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- crew-managed bike photos live on arbitrary hosts
            <img src={bike.imageUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--community-accent)]/15">
              <Bike className="h-3.5 w-3.5" />
            </span>
          )}
          {bike.title}
          {/* live availability — the wall agrees with the checkout gate */}
          <span className="flex items-center gap-1 font-normal opacity-80">
            <span
              className={`h-1.5 w-1.5 rounded-full ${bike.busyUntilIso ? "bg-red-400" : "bg-emerald-400"}`}
              aria-hidden="true"
            />
            {bike.busyUntilIso ? formatBusyUntil(bike.busyUntilIso) : "свободен"}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ── fullscreen lightbox with pinch-zoom / pan / double-tap / swipe ──────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface PhotoLightboxProps {
  photos: WallPhotoView[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

function PhotoLightbox({ photos, index, onClose, onIndexChange }: PhotoLightboxProps) {
  // gesture state — refs avoid re-renders on every pointermove
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [smooth, setSmooth] = useState(true); // CSS transition when NOT gesturing
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number; ox: number; oy: number; midX: number; midY: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  // Chrome Android synthesizes dblclick from touch — the mouse-only zoom path
  // must not fire after a touch gesture (it would instantly cancel it).
  const lastPointerType = useRef<string>("mouse");
  // The stage container (NOT the transformed image — its own rect moves with
  // the transform) is the transform-origin reference for zoom anchoring.
  const stageRef = useRef<HTMLDivElement | null>(null);

  const photo = photos[index];

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setSmooth(true);
  }, []);

  const go = useCallback(
    (delta: number) => {
      const next = clamp(index + delta, 0, photos.length - 1);
      if (next !== index) {
        reset();
        onIndexChange(next);
      }
    },
    [index, photos.length, onIndexChange, reset],
  );

  // scroll lock + keyboard nav + focus management (a11y):
  // focus moves into the dialog on open, Tab is trapped inside, focus returns
  // to the trigger on close.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Tab") {
        // simple focus trap: cycle within the dialog
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [onClose, go]);

  // Wheel state mirrored into a ref: the native wheel listener registers ONCE
  // (no teardown/re-add churn per zoom step) and always reads fresh values.
  const wheelState = useRef({ scale: 1, offset: { x: 0, y: 0 } });
  useEffect(() => {
    wheelState.current = { scale, offset };
  }, [scale, offset]);

  // Wheel zoom-to-cursor. Registered NATIVELY with { passive: false } —
  // React 18 attaches wheel at the root as passive, so e.preventDefault()
  // inside a React onWheel prop would be a silent no-op. Lives BEFORE the
  // early return (Rules of Hooks).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const { scale: curScale, offset: curOffset } = wheelState.current;
      const nextScale = clamp(curScale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 5);
      if (nextScale === 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        return;
      }
      setOffset(zoomAtPoint(curScale, curOffset, { x: e.clientX, y: e.clientY }, stageCenter(), nextScale));
      setScale(nextScale);
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  if (!photo) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPointerType.current = e.pointerType;
    setSmooth(false);

    if (pointers.current.size === 1) {
      // Double-tap detection — TOUCH only, at ANY scale (so a double-tap while
      // zoomed resets). For mice the native dblclick handler is the path: the
      // pointerdown detector would otherwise fire first at 2.5× and dblclick
      // would instantly cancel it.
      if (e.pointerType !== "mouse") {
        const now = Date.now();
        const last = lastTap.current;
        if (last && now - last.time < 300 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
          if (scale > 1) {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          } else {
            setScale(2.5);
            setOffset(
              zoomAtPoint(1, { x: 0, y: 0 }, { x: e.clientX, y: e.clientY }, stageCenter(), 2.5),
            );
          }
          lastTap.current = null;
          swipeStart.current = null;
          panStart.current = null;
          return;
        }
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
      if (scale > 1) {
        panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      } else {
        swipeStart.current = { x: e.clientX, y: e.clientY };
      }
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        ox: offset.x, // preserve the pan the user already had
        oy: offset.y,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
      swipeStart.current = null;
      panStart.current = null;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const start = pinchStart.current;
      const nextScale = clamp((start.scale * dist) / Math.max(start.dist, 1), 1, 5);
      // Anchor the pinch midpoint exactly at ANY start scale (ratio, not a
      // linear delta) and preserve the pre-pinch pan offset.
      setOffset(
        computeZoomOffset({
          startScale: start.scale,
          startOffset: { x: start.ox, y: start.oy },
          startMid: { x: start.midX, y: start.midY },
          currentMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          center: stageCenter(),
          nextScale,
        }),
      );
      setScale(nextScale);
    } else if (pointers.current.size === 1 && panStart.current && scale > 1) {
      const start = panStart.current;
      setOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const hadTwo = pointers.current.size === 2;
    pointers.current.delete(e.pointerId);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // A pinch gesture must not leave a stale tap marker: the next single-finger
    // touch within 300ms of the pinch start would otherwise false-fire the
    // double-tap reset mid-adjustment.
    if (hadTwo) lastTap.current = null;

    if (pointers.current.size === 0) {
      // swipe navigation only at natural zoom
      const swipe = swipeStart.current;
      if (swipe && scale <= 1.01 && !hadTwo) {
        const dx = e.clientX - swipe.x;
        const dy = e.clientY - swipe.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          go(dx < 0 ? 1 : -1);
          return;
        }
      }
      // snap back
      panStart.current = null;
      swipeStart.current = null;
      pinchStart.current = null;
      if (scale <= 1.05) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setSmooth(true);
      } else {
        setSmooth(true);
      }
    } else if (pointers.current.size === 1) {
      // two → one: re-anchor panning to the remaining finger
      const [rest] = [...pointers.current.values()];
      pinchStart.current = null;
      if (scale > 1) panStart.current = { x: rest.x, y: rest.y, ox: offset.x, oy: offset.y };
    }
  };

  // Stage centre = transform-origin of the image box. Measured from the stage
  // CONTAINER (never the transformed image — its own rect moves with it).
  function stageCenter(): { x: number; y: number } {
    const el = stageRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // Desktop zoom: native dblclick (guarded against touch-synthesized dblclick).
  const onDoubleClick = (e: React.MouseEvent) => {
    if (lastPointerType.current !== "mouse") return;
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(2.5);
      setOffset(zoomAtPoint(1, { x: 0, y: 0 }, { x: e.clientX, y: e.clientY }, stageCenter(), 2.5));
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-black/95 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] outline-none"
      style={{ touchAction: "none" }}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
    >
      {/* top bar — glassy counter chip + thumb-sized close */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums text-white/80 backdrop-blur">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть просмотр"
          className="cw-press flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* image stage */}
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div
          className="flex items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: smooth ? "transform 200ms ease-out" : "none",
            willChange: "transform",
            touchAction: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
          <img
            src={photo.url}
            alt={`Фото ${index + 1}`}
            draggable={false}
            className="max-h-[78vh] max-w-[94vw] select-none object-contain"
          />
        </div>

        {/* desktop arrows */}
        {photos.length > 1 && index > 0 && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Предыдущее фото"
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:block"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {photos.length > 1 && index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Следующее фото"
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 md:block"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* hint + thumbs */}
      <div className="flex flex-col items-center gap-2 px-4 pb-4">
        <p className="hidden text-[11px] text-white/50 md:block">
          Свайп ← → для навигации · двойной клик — зум · Esc — закрыть
        </p>
        <p className="text-[11px] text-white/50 md:hidden">
          Щипок — зум · двойной тап — зум · свайп — следующее фото
        </p>
        {photos.length > 1 && (
          <div className="flex max-w-full snap-x snap-mandatory gap-1.5 overflow-x-auto py-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  reset();
                  onIndexChange(i);
                }}
                aria-label={`Фото ${i + 1}`}
                className={`h-11 w-11 shrink-0 snap-center overflow-hidden rounded-lg border-2 transition ${
                  i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
                <img src={p.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reaction bar (VK-style) ──────────────────────────────────────────────────

const REACTION_PICKER_HOVER_MS = 250;
const REACTION_LONG_PRESS_MS = 350;
const REACTION_COACH_KEY = "onlybike-wall-reaction-coach";

/** Top emoji for the VK-style summary chip: counts desc, lib order as tiebreak. */
function topReactions(counts: Record<string, number>, max = 3): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || WALL_REACTIONS.indexOf(a[0] as never) - WALL_REACTIONS.indexOf(b[0] as never))
    .slice(0, max)
    .map(([emoji]) => emoji);
}

/** One flying emoji particle of the reaction burst (v5 special sauce). */
interface CwBurstParticle {
  key: string;
  emoji: string;
  /** launch point (viewport px, from the trigger button's centre) */
  x: number;
  y: number;
  /** random flight vector + spin + size + duration */
  dx: number;
  dy: number;
  s: number;
  rot: number;
  dur: number;
}

/** Telegram-native haptics, silent no-op outside the MiniApp WebView. */
function tgHaptic(kind: "light" | "select"): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void; selectionChanged?: () => void } } } }).Telegram?.WebApp?.HapticFeedback;
    if (!tg) return;
    if (kind === "light") tg.impactOccurred?.("light");
    else tg.selectionChanged?.();
  } catch {
    // plain web browser — haptics simply do not exist here
  }
}

/**
 * VK-style reaction control: quick tap toggles the viewer's current reaction
 * (default ❤️, re-tap removes); hover (desktop) or long-press (mobile, with
 * a Telegram-native haptic tick) opens the full emoji picker. A VK-style
 * summary chip («🔥😂❤ 12») sits next to the control, and a one-time
 * coach-mark makes the long-press discoverable.
 */
function ReactionBar({
  post,
  pending,
  canReact,
  onToggle,
  onOpenReactions,
}: {
  post: WallPostView;
  pending: boolean;
  /** false = anonymous visitor: tapping explains how to unlock reactions. */
  canReact: boolean;
  onToggle: (emoji: string) => void;
  /** «Кому понравилось»: tap on the summary chip (profile v1). */
  onOpenReactions: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pop, setPop] = useState(0);
  const [coachSeen, setCoachSeen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const longPressFired = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(REACTION_COACH_KEY)) setCoachSeen(false);
    } catch {
      // private mode — skip the coach-mark rather than crash
    }
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const openPicker = useCallback(() => {
    longPressFired.current = true;
    setPickerOpen(true);
    setCoachSeen(true);
    try {
      window.localStorage.setItem(REACTION_COACH_KEY, "1");
    } catch {
      // ignore
    }
    tgHaptic("light");
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    triggerRef.current?.focus();
  }, []);

  // v5 special sauce: emoji particles fly out of the button on every new
  // reaction. PORTALED to document.body — fixed positioning inside the
  // backdrop-blurred section would anchor to the section, not the viewport.
  const [bursts, setBursts] = useState<CwBurstParticle[]>([]);
  const burstSeq = useRef(0);
  const burstTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = burstTimers;
    return () => timers.current.forEach(clearTimeout);
  }, []);
  const fireBurst = useCallback((emoji: string) => {
    const el = triggerRef.current;
    if (!el) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const batch = ++burstSeq.current;
    const particles: CwBurstParticle[] = Array.from({ length: 7 }, (_, i) => ({
      key: `${batch}-${i}`,
      emoji,
      x,
      y,
      dx: (Math.random() - 0.5) * 96,
      dy: -44 - Math.random() * 78,
      s: 0.9 + Math.random() * 0.9,
      rot: (Math.random() - 0.5) * 44,
      dur: 0.66 + Math.random() * 0.3,
    }));
    setBursts((prev) => [...prev, ...particles]);
    burstTimers.current.push(
      setTimeout(() => {
        const keys = new Set(particles.map((p) => p.key));
        setBursts((prev) => prev.filter((b) => !keys.has(b.key)));
      }, 1050),
    );
  }, []);

  const quickToggle = useCallback(() => {
    if (pending) return;
    if (!canReact) {
      onToggle(post.viewerReaction ?? WALL_REACTIONS[0]); // parent shows the «открой через бота» notice
      return;
    }
    setPop((n) => n + 1);
    tgHaptic("light");
    // burst only when a reaction is SET (quick re-tap removes it — VK behaviour)
    if (!post.viewerReaction) fireBurst(post.viewerReaction ?? WALL_REACTIONS[0]);
    onToggle(post.viewerReaction ?? WALL_REACTIONS[0]);
  }, [pending, canReact, onToggle, post.viewerReaction, fireBurst]);

  const countLabel = `${post.likeCount} ${pluralRu(post.likeCount, ["реакция", "реакции", "реакций"])}`;
  const ariaLabel = post.viewerReaction
    ? `Реакция ${post.viewerReaction}, всего ${countLabel}, удержите или откройте меню для другой`
    : `Поставить реакцию, удержите для выбора эмодзи`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        if (!canReact || pending) return;
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(openPicker, REACTION_PICKER_HOVER_MS);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setPickerOpen(false);
        longPressFired.current = false;
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (longPressFired.current) {
            longPressFired.current = false;
            return;
          }
          quickToggle();
        }}
        onPointerDown={() => {
          if (!canReact || pending) return;
          if (pressTimer.current) clearTimeout(pressTimer.current);
          pressTimer.current = setTimeout(openPicker, REACTION_LONG_PRESS_MS);
        }}
        onPointerUp={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onPointerCancel={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onKeyDown={(e) => {
          // keyboard parity: ArrowDown opens the picker, Escape closes + restores focus
          if (e.key === "ArrowDown" && !pickerOpen) {
            e.preventDefault();
            openPicker();
          } else if (e.key === "Escape" && pickerOpen) {
            e.preventDefault();
            closePicker();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        aria-label={ariaLabel}
        className={`relative flex min-h-[44px] select-none items-center gap-1.5 rounded-full px-2.5 text-sm transition disabled:opacity-60 ${
          post.viewerReaction
            ? "text-[var(--community-accent)]"
            : "text-[var(--community-muted)] hover:text-[var(--community-accent)]"
        }`}
      >
        {post.viewerReaction ? (
          <span
            key={pop}
            className="inline-block text-base leading-none animate-reaction-pop"
          >
            {post.viewerReaction}
          </span>
        ) : (
          <Heart className="h-4 w-4 transition-transform active:scale-90" />
        )}
        {post.likeCount > 0 && <span>{post.likeCount}</span>}
        {!coachSeen && canReact && (
          <span className="absolute -top-1.5 left-full ml-1 hidden whitespace-nowrap rounded-full bg-[var(--community-accent)] px-2 py-0.5 text-[10px] font-semibold text-white shadow md:inline-flex">
            удержи — выбери эмодзи
          </span>
        )}
      </button>

      {/* VK-style summary chip: top emoji + total — TAP opens «Кому
          понравилось» (profile v1). Anonymous visitors get the same modal,
          which itself explains that the list is a riders-only surface. */}
      {post.likeCount > 0 && Object.keys(post.reactionCounts).length > 0 && (
        <button
          type="button"
          onClick={onOpenReactions}
          className="ml-1 inline-flex translate-y-[1px] items-center gap-0.5 rounded-full border border-[var(--community-border)] bg-[var(--community-card)] px-1.5 py-0.5 text-[11px] leading-none text-[var(--community-muted)] transition hover:border-[var(--community-accent)] hover:text-[var(--community-text)]"
          aria-label={`Кому понравилось: ${post.likeCount}`}
        >
          {topReactions(post.reactionCounts).map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
          <span className="font-semibold">{post.likeCount}</span>
        </button>
      )}

      {pickerOpen && (
        <>
          {/* click-away catcher */}
          <div className="fixed inset-0 z-30" onClick={closePicker} aria-hidden="true" />
          <div
            role="menu"
            aria-label="Выбрать реакцию"
            className="absolute bottom-full left-0 z-40 mb-2 flex items-end gap-0.5 rounded-full border border-[var(--community-border)] bg-[var(--community-card)] p-1 shadow-xl"
          >
            {WALL_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitemradio"
                aria-checked={post.viewerReaction === emoji}
                aria-label={`Реакция ${emoji}${post.reactionCounts[emoji] ? `, ${post.reactionCounts[emoji]}` : ""}`}
                onClick={() => {
                  closePicker();
                  longPressFired.current = false;
                  if (canReact && !pending) {
                    setPop((n) => n + 1);
                    tgHaptic("select");
                    fireBurst(emoji);
                    onToggle(emoji);
                  }
                }}
                className={`flex flex-col items-center rounded-full px-1.5 py-1 text-lg leading-none transition hover:scale-125 ${
                  post.viewerReaction === emoji ? "bg-[var(--community-accent)]/15" : ""
                }`}
              >
                <span>{emoji}</span>
                {(post.reactionCounts[emoji] ?? 0) > 0 && (
                  <span className="text-[9px] font-semibold leading-none text-[var(--community-muted)]">
                    {post.reactionCounts[emoji]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* v5: flying-emoji burst layer (see fireBurst) */}
      {bursts.length > 0 && (
        <WallOverlayPortal>
          <div className="cw-burst-layer" aria-hidden="true">
            {bursts.map((b) => (
              <span
                key={b.key}
                className="cw-burst-particle text-xl"
                style={{
                  "--cw-x": `${b.x}px`,
                  "--cw-y": `${b.y}px`,
                  "--cw-dx": `${b.dx}px`,
                  "--cw-dy": `${b.dy}px`,
                  "--cw-s": b.s,
                  "--cw-rot": `${b.rot}deg`,
                  "--cw-burst-dur": `${b.dur}s`,
                } as React.CSSProperties}
              >
                {b.emoji}
              </span>
            ))}
          </div>
        </WallOverlayPortal>
      )}
    </div>
  );
}

/**
 * Rich wall text: @mentions highlighted, #hashtags clickable (filter via the
 * parent handler), URLs open safely in a new tab. Rendering is token-based
 * (lib parseWallText) — no markdown, no HTML injection.
 */
function WallRichText({
  text,
  className,
  onHashtag,
}: {
  text: string;
  className?: string;
  onHashtag?: (tag: string) => void;
}) {
  const tokens = useMemo(() => parseWallText(text), [text]);
  return (
    <p className={className}>
      {tokens.map((t, i) => {
        if (t.type === "mention") {
          return (
            <span key={i} className="font-medium text-[var(--community-accent)]">
              {t.value}
            </span>
          );
        }
        if (t.type === "hashtag") {
          // Normalize EXACTLY like the DB rows (lowercased body, no '#') —
          // a mixed-case «#ВечернийЗаезд» must hit the tag filter, not lie empty.
          const body = hashtagKey(t.value);
          if (onHashtag) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onHashtag(body)}
                title={`Показать посты по тегу ${t.value}`}
                className="font-medium text-[var(--community-accent)] hover:underline"
              >
                {t.value}
              </button>
            );
          }
          return (
            <span key={i} className="font-medium text-[var(--community-accent)]">
              {t.value}
            </span>
          );
        }
        if (t.type === "url") {
          return (
            <a
              key={i}
              href={t.value}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-[var(--community-accent)] underline decoration-[var(--community-accent)]/40 underline-offset-2 hover:decoration-[var(--community-accent)]"
            >
              {t.value}
            </a>
          );
        }
        return <span key={i}>{t.value}</span>;
      })}
    </p>
  );
}

interface PostCardProps {
  post: WallPostView;
  /** position in the feed — drives the staggered entrance (capped at 8) */
  index: number;
  slug: string;
  viewer: WallViewerInfo | null;
  canModerate: boolean;
  expanded: boolean;
  commentsLoading: boolean;
  draft: string;
  sendingComment: boolean;
  likePending: boolean;
  replyTarget: { commentId: string; authorName: string } | null;
  onStartReply: (commentId: string, authorName: string) => void;
  onCancelReply: () => void;
  onToggleReaction: (emoji: string) => void;
  /** «Кому понравилось»: opens the reactors modal for this post. */
  onOpenReactions: () => void;
  onToggleComments: () => void;
  onTogglePin: () => void;
  onDraftChange: (v: string) => void;
  onSubmitComment: () => void;
  onHide: (hide: boolean) => void;
  onDelete: () => void;
  onHideComment: (commentId: string) => void;
  onOpenPhoto: (index: number) => void;
  onHashtag: (tag: string) => void;
  deeplinkBotUsername?: string | null;
}

function PostCard(props: PostCardProps) {
  const { post, slug, viewer, canModerate, expanded, commentsLoading, draft, sendingComment, likePending, replyTarget, onOpenReactions } = props;
  const isOwnPost = !!viewer?.userId && viewer.userId === post.author.userId;
  const authorName = post.author.fullName || post.author.username || "Райдер";

  // desktop spotlight — a soft accent glow that follows the mouse (rAF-throttled,
  // attached only for fine pointers, so mobile never pays for it)
  const cardRef = useRef<HTMLElement>(null);
  const spotRaf = useRef(0);
  const onCardPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = cardRef.current;
    if (!el) return;
    const { clientX, clientY } = e;
    if (spotRaf.current) return;
    spotRaf.current = requestAnimationFrame(() => {
      spotRaf.current = 0;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--cw-mx", `${clientX - rect.left}px`);
      el.style.setProperty("--cw-my", `${clientY - rect.top}px`);
    });
  }, []);
  // special sauce: milestone badge + days-since-first-ride on stats posts
  const milestone = post.stats ? riderMilestoneBadge(post.stats.ridesCount) : null;
  const daysInCrew = useMemo(() => {
    const first = post.stats?.firstRideAt;
    if (!first) return null;
    const ts = Date.parse(first);
    if (Number.isNaN(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  }, [post.stats]);

  /** VK/Telegram share: opens the native TG share dialog (MiniApp) or a tab.
   *  Wall v4: the shared link is a BOT DEEPLINK (startapp=post_<id>_<slug>)
   *  when the bot username is known — the receiver lands inside the Mini App
   *  exactly on this post (router FAST path + highlight flash). Without the
   *  bot we fall back to the web URL (#post-<id>), which also works anonymous. */
  const sharePost = useCallback(() => {
    const webUrl = `${window.location.origin}/franchize/${slug}/community#post-${post.id}`;
    let url = webUrl;
    if (props.deeplinkBotUsername) {
      try {
        url = buildTelegramAppLink(props.deeplinkBotUsername, wallPostStartParam(post.id, slug));
      } catch {
        url = webUrl;
      }
    }
    const text = `${authorName} на стене экипажа: ${buildWallPostPreview(post.body || "пост с фото", 120)}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
        return;
      }
    } catch {
      // plain web — fall through to window.open
    }
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [slug, post.id, post.body, authorName, props.deeplinkBotUsername]);

  return (
    <article
      id={`post-${post.id}`}
      ref={cardRef}
      onPointerMove={onCardPointerMove}
      style={{ "--cw-i": props.index } as React.CSSProperties}
      className={`cw-rise cw-card ${post.isPinned ? "cw-card-pinned" : ""} cw-spotlight p-4 md:p-5`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Rider profile v1: author identity is now a destination — avatar +
              name lead to the rider's public profile (Chain-style). Crew-scope
              posts (authorScope='crew') keep the plain header: the crew speaks,
              not a person. */}
          {post.authorScope === "rider" ? (
            <Link
              href={`/franchize/${slug}/rider/${post.author.userId}`}
              className="flex items-center gap-3 rounded-full transition hover:opacity-85"
              aria-label={`Профиль райдера ${authorName}`}
            >
              <Avatar url={post.author.avatarUrl} name={authorName} />
            </Link>
          ) : (
            <Avatar url={post.author.avatarUrl} name={authorName} />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {post.authorScope === "rider" ? (
                <Link
                  href={`/franchize/${slug}/rider/${post.author.userId}`}
                  className="text-sm font-semibold text-[var(--community-text)] underline-offset-2 transition hover:text-[var(--community-accent)] hover:underline"
                >
                  {authorName}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-[var(--community-text)]">{authorName}</p>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  post.authorScope === "crew"
                    ? "bg-[var(--community-accent)] text-[var(--community-accent-text)]"
                    : "border border-[var(--community-border)] text-[var(--community-muted)]"
                }`}
              >
                {post.authorScope === "crew" ? "Экипаж" : "Райдер"}
              </span>
              {post.isPinned && (
                <span className="flex items-center gap-1 rounded-full bg-[var(--community-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--community-accent)]">
                  <Pin className="h-3 w-3" /> закреплено
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--community-muted)] opacity-70">
              {formatRelativeTimeRu(post.createdAt)}
            </p>
          </div>
        </div>
        {(canModerate || isOwnPost) && (
          <div className="flex items-center gap-1">
            {canModerate && (
              <button
                type="button"
                onClick={props.onTogglePin}
                title={post.isPinned ? "Открепить пост" : "Закрепить пост"}
                aria-label={post.isPinned ? "Открепить пост" : "Закрепить пост"}
                className="rounded-full p-1.5 text-[var(--community-muted)] transition hover:bg-[var(--community-accent)]/10 hover:text-[var(--community-accent)]"
              >
                {post.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            )}
            {canModerate && (
              <button
                type="button"
                onClick={() => props.onHide(true)}
                title="Скрыть пост"
                aria-label="Скрыть пост"
                className="rounded-full p-1.5 text-[var(--community-muted)] transition hover:bg-[var(--community-accent)]/10 hover:text-[var(--community-accent)]"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={props.onDelete}
              title="Удалить пост"
              aria-label="Удалить пост"
              className="rounded-full p-1.5 text-[var(--community-muted)] transition hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* body */}
      {post.body && (
        <WallRichText
          text={post.body}
          className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--community-text)]"
          onHashtag={props.onHashtag}
        />
      )}

      {/* photos */}
      <PostPhotoGrid photos={post.photos} onOpen={props.onOpenPhoto} />

      {/* bike mentions */}
      <PostBikeChips bikes={post.bikes} slug={slug} />

      {/* stats snapshot */}
      {post.kind === "stats" && post.stats && (
        <div className="cw-dash mt-3 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--community-accent)]">
              <BarChart3 className="h-3.5 w-3.5" /> статистика поездок
            </p>
            {milestone && (
              <span
                title="Достижение за поездки с этим экипажем"
                className="cw-milestone rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[var(--community-accent)]"
              >
                {milestone.emoji} {milestone.label}
              </span>
            )}
          </div>
          <StatsGrid stats={post.stats} />
          {daysInCrew !== null && daysInCrew > 0 && (
            <p className="mt-2 text-[11px] text-[var(--community-muted)]">
              катает с экипажем уже {daysInCrew} {pluralRu(daysInCrew, ["день", "дня", "дней"])} — с первого заезда
            </p>
          )}
        </div>
      )}

      {/* attached rental */}
      {post.rental && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-3">
          {post.rental.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- crew-managed bike photos live on arbitrary hosts
            <img src={post.rental.imageUrl} alt={post.rental.bikeTitle} className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--community-accent)]/10">
              <Bike className="h-5 w-5 text-[var(--community-accent)]" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--community-text)]">{post.rental.bikeTitle}</p>
            <p className="text-xs text-[var(--community-muted)]">заезд из аренды экипажа</p>
          </div>
        </div>
      )}

      {/* actions row — v5: 44px thumb targets with inner padding (mobile) */}
      <div className="-mx-2 mt-3 flex items-center gap-1">
        <ReactionBar
          post={post}
          pending={likePending}
          canReact={!!viewer?.userId}
          onToggle={props.onToggleReaction}
          onOpenReactions={onOpenReactions}
        />
        <button
          type="button"
          onClick={props.onToggleComments}
          aria-expanded={expanded}
          aria-label="Комментарии"
          className="cw-press flex min-h-[44px] items-center gap-1.5 rounded-full px-2.5 text-sm text-[var(--community-muted)] transition hover:text-[var(--community-accent)]"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount > 0 ? pluralRu(post.commentCount, ["комментарий", "комментария", "комментариев"]) : "Комментировать"}
        </button>
        <button
          type="button"
          onClick={sharePost}
          aria-label="Поделиться в Telegram"
          title="Поделиться в Telegram"
          className="cw-press flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full text-sm text-[var(--community-muted)] transition hover:text-[var(--community-accent)]"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* comments — feed ships a newest-2 preview; expand lazy-loads the rest.
          The expand trigger renders even when the preview came back empty
          (global budget starvation), so the counter can never dead-end. */}
      {(expanded || post.commentCount > 0) && (
        <div className="mt-3 border-t border-[var(--community-border)] pt-3">
          {commentsLoading ? (
            <p className="flex items-center gap-2 text-xs text-[var(--community-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Загружаем комментарии…
            </p>
          ) : post.comments.length === 0 ? (
            post.commentCount > 0 ? (
              <button
                type="button"
                onClick={props.onToggleComments}
                className="text-xs font-semibold text-[var(--community-accent)]"
              >
                Показать комментарии ({post.commentCount})
              </button>
            ) : (
              <p className="text-xs text-[var(--community-muted)] opacity-70">Пока нет комментариев.</p>
            )
          ) : (
            <ul className="flex flex-col gap-2.5">
              {post.comments.map((c) => {
                const cName = c.author.fullName || c.author.username || "Райдер";
                return (
                  <li key={c.id} className="group flex items-start gap-2.5">
                    <Avatar url={c.author.avatarUrl} name={cName} size={28} />
                    <div className="min-w-0 flex-1 rounded-xl bg-[var(--community-base-soft)] px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        {/* Comment authors link to their rider profile too (profile v1). */}
                        <Link
                          href={`/franchize/${slug}/rider/${c.author.userId}`}
                          className="truncate text-xs font-semibold text-[var(--community-text)] underline-offset-2 transition hover:text-[var(--community-accent)] hover:underline"
                        >
                          {cName}
                        </Link>
                        <span className="shrink-0 text-[10px] text-[var(--community-muted)] opacity-70">
                          {formatDateTimeRu(c.createdAt)}
                        </span>
                      </div>
                      {c.replyTo && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--community-muted)]">
                          <CornerDownRight className="h-3 w-3" />
                          <span className="font-medium">{c.replyTo.authorName}</span>
                        </p>
                      )}
                      <WallRichText
                        text={c.body}
                        className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--community-text)]"
                        onHashtag={props.onHashtag}
                      />
                    </div>
                    <div className="flex shrink-0 items-start">
                      <button
                        type="button"
                        onClick={() => {
                          props.onStartReply(c.id, cName);
                          // The composer exists only in the expanded block —
                          // replying to a preview comment must reveal it first.
                          if (!expanded) props.onToggleComments();
                        }}
                        title={`Ответить ${cName}`}
                        aria-label={`Ответить ${cName}`}
                        className="rounded-full p-1 text-[var(--community-muted)] opacity-0 transition hover:text-[var(--community-accent)] focus:opacity-100 group-hover:opacity-100 max-md:opacity-70"
                      >
                        <CornerDownRight className="h-3.5 w-3.5" />
                      </button>
                      {canModerate && (
                        <button
                          type="button"
                          onClick={() => props.onHideComment(c.id)}
                          title="Скрыть комментарий"
                          aria-label="Скрыть комментарий"
                          className="rounded-full p-1 text-[var(--community-muted)] transition hover:text-red-400"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!commentsLoading &&
            !expanded &&
            post.comments.length > 0 &&
            post.comments.length < Math.min(WALL_COMMENTS_FETCH_LIMIT, post.commentCount) && (
              <button
                type="button"
                onClick={props.onToggleComments}
                className="mt-2 text-xs font-semibold text-[var(--community-accent)]"
              >
                Показать все комментарии ({post.commentCount})
              </button>
            )}
          {expanded && viewer?.userId && (
            <div className="mt-3">
              {replyTarget && (
                <div className="mb-1.5 flex items-center gap-2 text-xs text-[var(--community-muted)]">
                  <CornerDownRight className="h-3 w-3" />
                  <span>
                    Ответ <span className="font-semibold text-[var(--community-text)]">{replyTarget.authorName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={props.onCancelReply}
                    aria-label="Отменить ответ"
                    className="rounded-full p-0.5 transition hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  key={replyTarget?.commentId ?? "plain"}
                  value={draft}
                  autoFocus={!!replyTarget}
                  onChange={(e) => props.onDraftChange(e.target.value.slice(0, WALL_COMMENT_MAX_LEN))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      props.onSubmitComment();
                    }
                  }}
                  placeholder={replyTarget ? `Ответить ${replyTarget.authorName}…` : "Твой комментарий…"}
                  className="min-h-[44px] flex-1 rounded-full border border-[var(--community-border)] bg-transparent px-4 py-2 text-sm text-[var(--community-text)] outline-none placeholder:text-[var(--community-muted)] focus:border-[var(--community-accent)] focus:ring-2 focus:ring-[var(--community-accent)]/25"
                />
                <button
                  type="button"
                  onClick={props.onSubmitComment}
                  disabled={sendingComment || !draft.trim()}
                  className="cw-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--community-accent)] text-[var(--community-accent-text)] shadow-[0_6px_20px_-8px_var(--community-accent)] disabled:opacity-40"
                  title="Отправить"
                >
                  {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
