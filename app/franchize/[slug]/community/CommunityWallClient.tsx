"use client";

// app/franchize/[slug]/community/CommunityWallClient.tsx
//
// ─────────────────────────────────────────────────────────────────────────────
// OnlyBike community wall — the live part of the /community page (wall v2).
// A VK-style wall for the crew and its riders/renters:
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
import Link from "next/link";
import {
  BarChart3,
  Bike,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Heart,
  ImagePlus,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  PinOff,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  formatDateTimeRu,
  formatRelativeTimeRu,
  formatRub,
  pluralRu,
  computeZoomOffset,
  zoomAtPoint,
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
  createCommunityPostAction,
  deleteCommunityPostAction,
  getCommunityWallAction,
  getMyRentalStatsAction,
  getPostCommentsAction,
  getWallBikeOptionsAction,
  hideCommunityCommentAction,
  hideCommunityPostAction,
  setPostPinnedAction,
  togglePostReactionAction,
  type WallBikeOption,
} from "@/app/franchize/server-actions/community-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import { reduceImageResolution } from "@/lib/client-image-compress";

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

interface CommunityWallClientProps {
  slug: string;
  crewName: string;
  /** Fallback for locked visitors: «открой через бота». */
  botUsername?: string | null;
}

export function CommunityWallClient({ slug, crewName, botUsername }: CommunityWallClientProps) {
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

  // interactions
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [sendingCommentFor, setSendingCommentFor] = useState<Record<string, boolean>>({});
  const [loadingCommentsFor, setLoadingCommentsFor] = useState<Record<string, boolean>>({});
  const [wallNotice, setWallNotice] = useState<string | null>(null);

  const withInitData = useCallback(() => getTelegramInitData(), []);

  const loadFeed = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setFeedError(null);
    const res = await getCommunityWallAction({ slug, initData: withInitData() });
    if (res.ok) {
      setPosts(res.posts);
      setViewer(res.viewer);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } else {
      setFeedError(res.error);
    }
    setLoading(false);
  }, [slug, withInitData]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    const res = await getCommunityWallAction({ slug, initData: withInitData(), before: nextBefore });
    if (res.ok) {
      setPosts((prev) => [...prev, ...res.posts]);
      setHasMore(res.hasMore);
      setNextBefore(res.nextBefore);
    } else {
      setWallNotice(res.error);
    }
    setLoadingMore(false);
  }, [slug, nextBefore, loadingMore, withInitData]);

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
          const blob = await reduceImageResolution(file, { maxSize: 1600, quality: 0.72 });
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
    } else {
      setComposerError(res.error);
    }
    setPosting(false);
  }, [posting, failedUploads, slug, text, shareStats, withInitData, composerPhotos, selectedBikes, setComposerPhotosSync]);

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
    setSendingCommentFor((prev) => ({ ...prev, [post.id]: true }));
    const res = await addPostCommentAction({ postId: post.id, body: draft, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, comments: [...p.comments, res.comment], commentCount: res.commentCount } : p,
        ),
      );
      setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
      setExpanded((prev) => new Set(prev).add(post.id));
    } else {
      setWallNotice(res.error);
    }
    setSendingCommentFor((prev) => ({ ...prev, [post.id]: false }));
  }, [commentDrafts, sendingCommentFor, viewer, withInitData]);

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
      className="w-full border-y border-[var(--community-border)] bg-[var(--community-card-soft)] backdrop-blur-xl"
      aria-label="Стена сообщества экипажа"
    >
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--community-border)] px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-[var(--community-accent)]" />
          <h2 className="font-orbitron text-xl md:text-2xl text-[var(--community-text)]">Стена экипажа</h2>
        </div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--community-muted)] opacity-70">
          OnlyBike community
        </p>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 md:px-8 md:py-6">
        {wallNotice && (
          <button
            type="button"
            onClick={() => setWallNotice(null)}
            className="rounded-2xl border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 px-4 py-2 text-left text-sm text-[var(--community-accent)]"
          >
            {wallNotice} — нажми, чтобы скрыть
          </button>
        )}

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
          <div className="rounded-2xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-4">
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
                  className="flex items-center gap-2 rounded-full border border-[var(--community-border)] px-3.5 py-2 text-xs font-semibold text-[var(--community-muted)] transition hover:border-[var(--community-accent)] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
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
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
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
                className="flex items-center gap-2 rounded-full bg-[var(--community-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--community-accent-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="flex items-center justify-center gap-2 py-10 text-[var(--community-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Загружаем стену…</span>
          </div>
        ) : feedError ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">
            {feedError}
            <button type="button" onClick={() => void loadFeed()} className="ml-2 underline">
              Повторить
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--community-border)] bg-[var(--community-card-faint)] p-8 text-center">
            <Bike className="mx-auto h-8 w-8 text-[var(--community-accent)]" />
            <p className="mt-3 text-sm font-semibold text-[var(--community-text)]">
              Стена экипажа {crewName} пока пустая — будь первым!
            </p>
            <p className="mt-1 text-sm text-[var(--community-muted)]">
              Расскажи про свой первый заезд, прикрепи фото или поделись статистикой поездок.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                slug={slug}
                viewer={viewer}
                canModerate={canModerate}
                expanded={expanded.has(post.id)}
                commentsLoading={!!loadingCommentsFor[post.id]}
                draft={commentDrafts[post.id] ?? ""}
                sendingComment={!!sendingCommentFor[post.id]}
                likePending={pendingLikes.has(post.id)}
                onToggleReaction={(emoji) => void toggleReaction(post, emoji)}
                onToggleComments={() => void toggleComments(post)}
                onTogglePin={() => void togglePin(post)}
                onDraftChange={(v) => setCommentDrafts((prev) => ({ ...prev, [post.id]: v }))}
                onSubmitComment={() => void submitComment(post)}
                onHide={(hide) => void moderatePost(post, hide)}
                onDelete={() => void deletePost(post)}
                onHideComment={(commentId) => void hideComment(post, commentId)}
                onOpenPhoto={(index) => setLightbox({ postId: post.id, index })}
              />
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="mx-auto flex items-center gap-2 rounded-full border border-[var(--community-border)] px-6 py-2.5 text-sm font-semibold text-[var(--community-text)] transition hover:border-[var(--community-accent)] disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Показать ещё
          </button>
        )}
      </div>

      {/* fullscreen photo viewer with pinch-zoom */}
      {lightboxPost && lightbox && lightboxPost.photos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPost.photos}
          index={Math.min(lightbox.index, lightboxPost.photos.length - 1)}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) => setLightbox({ postId: lightboxPost.id, index })}
        />
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

function StatsGrid({ stats, compact = false }: { stats: RentalStatsSnapshot; compact?: boolean }) {
  const cells: { value: string; label: string }[] = [
    { value: String(stats.ridesCount), label: pluralRu(stats.ridesCount, ["поездка", "поездки", "поездок"]) },
    { value: String(stats.hoursRented), label: pluralRu(stats.hoursRented, ["час в седле", "часа в седле", "часов в седле"]) },
    { value: formatRub(stats.totalSpent), label: "потрачено" },
    { value: String(stats.bikesUsed), label: pluralRu(stats.bikesUsed, ["байк", "байка", "байков"]) },
  ];
  return (
    <div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2"}`}>
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--community-border)] bg-[var(--community-card-faint)] p-3 text-center">
            <p className="font-orbitron text-lg text-[var(--community-accent)] md:text-xl">{c.value}</p>
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

// ── photo grid (VK-style: 1 → large, 2+ → even grid) ────────────────────────

function PostPhotoGrid({ photos, onOpen }: { photos: WallPhotoView[]; onOpen: (index: number) => void }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    const p = photos[0];
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onOpen(0)}
          className="block w-full overflow-hidden rounded-xl border border-[var(--community-border)] bg-[var(--community-base-soft)]"
          aria-label="Открыть фото"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
          <img
            src={p.url}
            alt="Фото поста"
            loading="lazy"
            className="mx-auto max-h-[560px] w-full object-contain"
          />
        </button>
      </div>
    );
  }
  return (
    <div className={`mt-3 grid gap-1.5 ${photos.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {photos.map((p, i) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(i)}
          className="aspect-square overflow-hidden rounded-xl border border-[var(--community-border)]"
          aria-label={`Открыть фото ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- public wallpix URLs */}
          <img src={p.url} alt={`Фото ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// ── bike mention chips on a post ─────────────────────────────────────────────

function PostBikeChips({ bikes, slug }: { bikes: WallBikeRefView[]; slug: string }) {
  if (bikes.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {bikes.map((bike) => (
        <Link
          key={bike.bikeId}
          href={`/franchize/${slug}/catalog`}
          title={`Открыть каталог — ${bike.title}`}
          className="flex items-center gap-2 rounded-full border border-[var(--community-accent)]/40 bg-[var(--community-accent)]/10 py-1 pl-1 pr-3 text-xs font-semibold text-[var(--community-accent)] transition hover:bg-[var(--community-accent)]/20"
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
          <span className="font-normal opacity-70">· из каталога</span>
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

  // scroll lock + keyboard nav
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
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
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      style={{ touchAction: "none" }}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm tabular-nums text-white/80">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть просмотр"
          className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
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
          <div className="flex max-w-full gap-1.5 overflow-x-auto py-1">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  reset();
                  onIndexChange(i);
                }}
                aria-label={`Фото ${i + 1}`}
                className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 transition ${
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
}: {
  post: WallPostView;
  pending: boolean;
  /** false = anonymous visitor: tapping explains how to unlock reactions. */
  canReact: boolean;
  onToggle: (emoji: string) => void;
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

  const quickToggle = useCallback(() => {
    if (pending) return;
    if (!canReact) {
      onToggle(post.viewerReaction ?? WALL_REACTIONS[0]); // parent shows the «открой через бота» notice
      return;
    }
    setPop((n) => n + 1);
    tgHaptic("light");
    onToggle(post.viewerReaction ?? WALL_REACTIONS[0]);
  }, [pending, canReact, onToggle, post.viewerReaction]);

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
        className={`relative flex select-none items-center gap-1.5 text-sm transition disabled:opacity-60 ${
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

      {/* VK-style summary chip: top emoji + total, pure display */}
      {post.likeCount > 0 && Object.keys(post.reactionCounts).length > 0 && (
        <span
          className="ml-1 inline-flex translate-y-[1px] items-center gap-0.5 rounded-full border border-[var(--community-border)] bg-[var(--community-card)] px-1.5 py-0.5 text-[11px] leading-none text-[var(--community-muted)]"
          aria-hidden="true"
        >
          {topReactions(post.reactionCounts).map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
          <span className="font-semibold">{post.likeCount}</span>
        </span>
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
    </div>
  );
}

interface PostCardProps {
  post: WallPostView;
  slug: string;
  viewer: WallViewerInfo | null;
  canModerate: boolean;
  expanded: boolean;
  commentsLoading: boolean;
  draft: string;
  sendingComment: boolean;
  likePending: boolean;
  onToggleReaction: (emoji: string) => void;
  onToggleComments: () => void;
  onTogglePin: () => void;
  onDraftChange: (v: string) => void;
  onSubmitComment: () => void;
  onHide: (hide: boolean) => void;
  onDelete: () => void;
  onHideComment: (commentId: string) => void;
  onOpenPhoto: (index: number) => void;
}

function PostCard(props: PostCardProps) {
  const { post, slug, viewer, canModerate, expanded, commentsLoading, draft, sendingComment, likePending } = props;
  const isOwnPost = !!viewer?.userId && viewer.userId === post.author.userId;
  const authorName = post.author.fullName || post.author.username || "Райдер";

  return (
    <article
      className={`rounded-2xl border bg-[var(--community-card-faint)] p-4 transition md:p-5 ${
        post.isPinned ? "border-[var(--community-accent)]/50" : "border-[var(--community-border)]"
      }`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar url={post.author.avatarUrl} name={authorName} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-[var(--community-text)]">{authorName}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  post.authorScope === "crew"
                    ? "bg-[var(--community-accent)] text-[var(--community-accent-text)]"
                    : "border border-[var(--community-border)] text-[var(--community-muted)]"
                }`}
              >
                {post.authorScope === "crew" ? "Экипаж" : "Райдер"}
              </span>
              {post.isPinned && <Pin className="h-3.5 w-3.5 text-[var(--community-accent)]" />}
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
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--community-text)]">{post.body}</p>
      )}

      {/* photos */}
      <PostPhotoGrid photos={post.photos} onOpen={props.onOpenPhoto} />

      {/* bike mentions */}
      <PostBikeChips bikes={post.bikes} slug={slug} />

      {/* stats snapshot */}
      {post.kind === "stats" && post.stats && (
        <div className="mt-3 rounded-xl border border-[var(--community-accent)]/30 bg-[var(--community-accent)]/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--community-accent)]">
            <BarChart3 className="h-3.5 w-3.5" /> статистика поездок
          </p>
          <StatsGrid stats={post.stats} />
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

      {/* actions row */}
      <div className="mt-3 flex items-center gap-4">
        <ReactionBar
          post={post}
          pending={likePending}
          canReact={!!viewer?.userId}
          onToggle={props.onToggleReaction}
        />
        <button
          type="button"
          onClick={props.onToggleComments}
          aria-expanded={expanded}
          aria-label="Комментарии"
          className="flex items-center gap-1.5 text-sm text-[var(--community-muted)] transition hover:text-[var(--community-accent)]"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount > 0 ? pluralRu(post.commentCount, ["комментарий", "комментария", "комментариев"]) : "Комментировать"}
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
                  <li key={c.id} className="flex items-start gap-2.5">
                    <Avatar url={c.author.avatarUrl} name={cName} size={28} />
                    <div className="min-w-0 flex-1 rounded-xl bg-[var(--community-base-soft)] px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-[var(--community-text)]">{cName}</p>
                        <span className="shrink-0 text-[10px] text-[var(--community-muted)] opacity-70">
                          {formatDateTimeRu(c.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[var(--community-text)]">{c.body}</p>
                    </div>
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
                  </li>
                );
              })}
            </ul>
          )}
          {!commentsLoading &&
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
            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => props.onDraftChange(e.target.value.slice(0, WALL_COMMENT_MAX_LEN))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    props.onSubmitComment();
                  }
                }}
                placeholder="Твой комментарий…"
                className="flex-1 rounded-full border border-[var(--community-border)] bg-transparent px-4 py-2 text-sm text-[var(--community-text)] outline-none placeholder:text-[var(--community-muted)] focus:border-[var(--community-accent)]"
              />
              <button
                type="button"
                onClick={props.onSubmitComment}
                disabled={sendingComment || !draft.trim()}
                className="rounded-full bg-[var(--community-accent)] p-2 text-[var(--community-accent-text)] transition hover:brightness-110 disabled:opacity-40"
                title="Отправить"
              >
                {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
