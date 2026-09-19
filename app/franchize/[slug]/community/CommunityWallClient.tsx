"use client";

// app/franchize/[slug]/community/CommunityWallClient.tsx
//
// ─────────────────────────────────────────────────────────────────────────────
// OnlyBike community wall — the live part of the /community page.
// A VK-style wall for the crew and its riders/renters:
//   • feed of posts (pinned first), stats-brag posts with a snapshot card;
//   • composer: free text + «Поделиться статистикой» (server computes the
//     rider's rental stats from real rentals — not client-claimed);
//   • likes + one-level comments, staff moderation (hide) / author delete.
//
// Identity: server actions resolve the Telegram actor (signed cookie or
// HMAC-verified initData). Anonymous web visitors get a read-only wall with a
// locked composer. Styling rides on the --community-* CSS vars set by the
// page, so the wall inherits the crew theme automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bike,
  EyeOff,
  Heart,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  PinOff,
  Send,
  Trash2,
} from "lucide-react";
import {
  formatDateTimeRu,
  formatRelativeTimeRu,
  formatRub,
  pluralRu,
  WALL_COMMENT_MAX_LEN,
  WALL_COMMENTS_FETCH_LIMIT,
  WALL_POST_MAX_LEN,
  type RentalStatsSnapshot,
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
  hideCommunityCommentAction,
  hideCommunityPostAction,
  setPostPinnedAction,
  togglePostLikeAction,
} from "@/app/franchize/server-actions/community-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";

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

  // ── composer ────────────────────────────────────────────────────────────────

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

  const submitPost = useCallback(async () => {
    if (posting) return;
    setPosting(true);
    setComposerError(null);
    const res = await createCommunityPostAction({
      slug,
      body: text.trim() || undefined,
      shareStats,
      initData: withInitData(),
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
    } else {
      setComposerError(res.error);
    }
    setPosting(false);
  }, [posting, slug, text, shareStats, withInitData]);

  // ── likes / comments / moderation ──────────────────────────────────────────

  const toggleLike = useCallback(async (post: WallPostView) => {
    if (pendingLikes.has(post.id)) return;
    if (!viewer?.userId) {
      setWallNotice("Лайки доступны из Telegram-бота экипажа.");
      return;
    }
    setPendingLikes((prev) => new Set(prev).add(post.id));
    // optimistic flip
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByViewer: !p.likedByViewer, likeCount: p.likeCount + (p.likedByViewer ? -1 : 1) }
          : p,
      ),
    );
    const res = await togglePostLikeAction({ postId: post.id, initData: withInitData() });
    if (res.ok) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likedByViewer: res.liked, likeCount: res.likeCount } : p)));
    } else {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByViewer: post.likedByViewer, likeCount: post.likeCount }
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

  return (
    <section
      className="overflow-hidden rounded-3xl border border-[var(--community-border)] bg-[var(--community-card-soft)] shadow-2xl backdrop-blur-xl"
      aria-label="Стена сообщества экипажа"
    >
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--community-border)] px-5 py-4 md:px-8">
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
                  Открой эту страницу через бота экипажа — и публикуй посты, хвастайся статистикой поездок, комментируй.
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
            {shareStats && (
              <StatsPreviewCard stats={statsPreview} loading={statsLoading} />
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
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
                  {statsLoading ? "Считаем поездки…" : "Поделиться статистикой"}
                </button>
                <span className="text-xs text-[var(--community-muted)] opacity-70">
                  {text.length} / {WALL_POST_MAX_LEN}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void submitPost()}
                disabled={posting || (!text.trim() && !shareStats)}
                className="flex items-center gap-2 rounded-full bg-[var(--community-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--community-accent-text)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Опубликовать
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
              Расскажи про свой первый заезд или поделись статистикой поездок.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewer={viewer}
                canModerate={canModerate}
                expanded={expanded.has(post.id)}
                commentsLoading={!!loadingCommentsFor[post.id]}
                draft={commentDrafts[post.id] ?? ""}
                sendingComment={!!sendingCommentFor[post.id]}
                likePending={pendingLikes.has(post.id)}
                onToggleLike={() => void toggleLike(post)}
                onToggleComments={() => void toggleComments(post)}
                onTogglePin={() => void togglePin(post)}
                onDraftChange={(v) => setCommentDrafts((prev) => ({ ...prev, [post.id]: v }))}
                onSubmitComment={() => void submitComment(post)}
                onHide={(hide) => void moderatePost(post, hide)}
                onDelete={() => void deletePost(post)}
                onHideComment={(commentId) => void hideComment(post, commentId)}
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

interface PostCardProps {
  post: WallPostView;
  viewer: WallViewerInfo | null;
  canModerate: boolean;
  expanded: boolean;
  commentsLoading: boolean;
  draft: string;
  sendingComment: boolean;
  likePending: boolean;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onTogglePin: () => void;
  onDraftChange: (v: string) => void;
  onSubmitComment: () => void;
  onHide: (hide: boolean) => void;
  onDelete: () => void;
  onHideComment: (commentId: string) => void;
}

function PostCard(props: PostCardProps) {
  const { post, viewer, canModerate, expanded, commentsLoading, draft, sendingComment, likePending } = props;
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
        <button
          type="button"
          onClick={props.onToggleLike}
          disabled={likePending}
          aria-pressed={post.likedByViewer}
          aria-label="Нравится"
          className={`flex items-center gap-1.5 text-sm transition disabled:opacity-60 ${
            post.likedByViewer ? "text-red-400" : "text-[var(--community-muted)] hover:text-red-400"
          }`}
        >
          <Heart className={`h-4 w-4 ${post.likedByViewer ? "fill-current" : ""}`} />
          {post.likeCount > 0 && <span>{post.likeCount}</span>}
        </button>
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
