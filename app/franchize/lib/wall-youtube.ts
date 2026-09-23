// app/franchize/lib/wall-youtube.ts
// ─────────────────────────────────────────────────────────────────────────────
// YouTube-ссылки в постах стены («add possibility to add youtube links to
// posts on wall, show actual videos in posts» — map-riders/community,
// 2026-09-23).
//
// Пост-тело остаётся обычным текстом: парсер достаёт из него YouTube-ссылки,
// а UI рисует под телом ленивый плеер (превью-кадр → тап → <iframe>).
//
// Безопасность:
//  · id валидируется по строгому charset [A-Za-z0-9_-]{11} — в iframe попадает
//    только он, никакого текста из поста;
//  · плеер грузится с youtube-nocookie.com (privacy-enhanced);
//  · превью — статический кадр с i.ytimg.com (тот же Google-хост, без JS);
//  · функция pure — тестируется без DOM (см. tests/franchize/wall-youtube.spec).
// ─────────────────────────────────────────────────────────────────────────────

/** Сколько видео показываем под одним постом (остальные остаются ссылками). */
export const WALL_YOUTUBE_MAX = 2;

/** YouTube video id: ровно 11 символов из безопасного charset. */
export function isYouTubeVideoId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Внутренний: вытащить id из одной уже найденной YouTube-ссылки. */
function idFromUrl(raw: string): string | null {
  // Отрезаем хвост-пунктуацию (пост мог закончиться «…youtu.be/XyZ12.»).
  const url = raw.replace(/[.,;:!?)»”']+$/, "");
  if (!url) return null;

  // Только http(s) — никаких протокольных трюков.
  if (!/^https:\/\//i.test(url)) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  const isYt = host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com" || host === "music.youtube.com";
  if (!isYt) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = segments[0] ?? "";
    return isYouTubeVideoId(id) ? id : null;
  }

  // youtube.com/watch?v=<id> (в т.ч. music.youtube.com)
  const v = parsed.searchParams.get("v");
  if (v && isYouTubeVideoId(v)) return v;

  // youtube.com/shorts/<id> | /embed/<id> | /live/<id>
  if (segments.length >= 2 && ["shorts", "embed", "live"].includes(segments[0])) {
    const id = segments[1];
    if (isYouTubeVideoId(id)) return id;
  }

  return null;
}

const YT_URL_RE = /https?:\/\/[^\s<>"']+/gi;

/**
 * Все YouTube-ссылки в тексте поста → уникальные video id (до `limit`).
 * Порядок сохраняется (первое видео в тексте = первое под постом).
 * Не-YouTube ссылки, битые id и протоколы не из http(s) молча пропускаются —
 * они остаются обычными ссылками в WallRichText.
 */
export function extractYouTubeVideoIds(text: string, limit: number = WALL_YOUTUBE_MAX): string[] {
  if (!text || limit <= 0) return [];
  const seen = new Set<string>();
  for (const match of text.matchAll(YT_URL_RE)) {
    const id = idFromUrl(match[0]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/** Превью-кадр для ленивой карточки (клик подменяет её на iframe). */
export function youTubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
}

/** Плеер для активированной карточки. nocookie + playsinline для TG WebView. */
export function youTubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
}
