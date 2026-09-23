// tests/franchize/wall-youtube.spec.ts
//
// YouTube-видео в постах стены: pure-парсер ссылок → video id (unit) +
// source-контракт рендера в CommunityWallClient (ленивый iframe-плеер).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractYouTubeVideoIds,
  isYouTubeVideoId,
  youTubeEmbedUrl,
  youTubeThumbUrl,
  WALL_YOUTUBE_MAX,
} from "@/app/franchize/lib/wall-youtube";

const CLIENT = "app/franchize/[slug]/community/CommunityWallClient.tsx";

describe("extractYouTubeVideoIds", () => {
  it("empty / hostile input", () => {
    expect(extractYouTubeVideoIds("")).toEqual([]);
    expect(extractYouTubeVideoIds("   ")).toEqual([]);
    expect(extractYouTubeVideoIds("look at this: javascript:alert(1)")).toEqual([]);
  });

  it("watch?v= classic form", () => {
    expect(extractYouTubeVideoIds("видео с заезда https://www.youtube.com/watch?v=dQw4w9WgXcQ смотри")).toEqual([
      "dQw4w9WgXcQ",
    ]);
  });

  it("youtu.be short form + trailing punctuation is trimmed", () => {
    expect(extractYouTubeVideoIds("https://youtu.be/dQw4w9WgXcQ.")).toEqual(["dQw4w9WgXcQ"]);
  });

  it("shorts / embed / live paths", () => {
    expect(extractYouTubeVideoIds("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual(["dQw4w9WgXcQ"]);
    expect(extractYouTubeVideoIds("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual(["dQw4w9WgXcQ"]);
    expect(extractYouTubeVideoIds("https://www.youtube.com/live/dQw4w9WgXcQ")).toEqual(["dQw4w9WgXcQ"]);
  });

  it("m. and music. hosts work too", () => {
    expect(extractYouTubeVideoIds("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(["dQw4w9WgXcQ"]);
    expect(extractYouTubeVideoIds("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(["dQw4w9WgXcQ"]);
  });

  it("extra query params do not break the id", () => {
    expect(
      extractYouTubeVideoIds("https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ&t=42s"),
    ).toEqual(["dQw4w9WgXcQ"]);
  });

  it("invalid ids (charset/length) are rejected", () => {
    // 10 chars — короткий, 12 — длинный, с $ — чужой charset
    expect(extractYouTubeVideoIds("https://youtu.be/dQw4w9WgXc")).toEqual([]);
    expect(extractYouTubeVideoIds("https://youtu.be/dQw4w9WgXcQQ")).toEqual([]);
    expect(extractYouTubeVideoIds("https://youtu.be/dQw4w9W$$cQ")).toEqual([]);
    expect(isYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeVideoId("dQw4w9WgXc")).toBe(false);
  });

  it("non-youtube links are ignored", () => {
    expect(extractYouTubeVideoIds("https://vimeo.com/123456789 и https://rutube.ru/video/abc/")).toEqual([]);
  });

  it("http (non-https) links are ignored", () => {
    expect(extractYouTubeVideoIds("http://youtu.be/dQw4w9WgXcQ")).toEqual([]);
  });

  it("dedupes repeats and caps at WALL_YOUTUBE_MAX", () => {
    const two = "https://youtu.be/dQw4w9WgXcQ https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(extractYouTubeVideoIds(two)).toEqual(["dQw4w9WgXcQ"]);
    const three =
      "https://youtu.be/dQw4w9WgXcQ https://youtu.be/9bZkp7q19f0 https://youtu.be/kJQP7kiw5Fk";
    expect(extractYouTubeVideoIds(three)).toEqual(["dQw4w9WgXcQ", "9bZkp7q19f0"]);
    expect(extractYouTubeVideoIds(three)).toHaveLength(WALL_YOUTUBE_MAX);
    // limit=0 → nothing
    expect(extractYouTubeVideoIds(three, 0)).toEqual([]);
    // order follows the text
    expect(extractYouTubeVideoIds("https://youtu.be/9bZkp7q19f0 https://youtu.be/dQw4w9WgXcQ")).toEqual([
      "9bZkp7q19f0",
      "dQw4w9WgXcQ",
    ]);
  });
});

describe("youTube*Url builders", () => {
  it("thumb + embed are stable and host-scoped", () => {
    expect(youTubeThumbUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(youTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1",
    );
  });
});

describe("wall post video render contract (source assertions)", () => {
  const src = readFileSync(CLIENT, "utf8");

  it("PostCard renders WallPostVideos right after the photo grid", () => {
    const gridIdx = src.indexOf("<PostPhotoGrid photos={post.photos} onOpen={props.onOpenPhoto} />");
    const videosIdx = src.indexOf("<WallPostVideos body={post.body ?? \"\"} />");
    expect(gridIdx).toBeGreaterThan(-1);
    expect(videosIdx).toBeGreaterThan(gridIdx);
  });

  it("the player is the privacy-enhanced nocookie host and lazy", () => {
    expect(src).toContain("youTubeEmbedUrl(videoId)");
    expect(src).toContain("loading=\"lazy\"");
    expect(src).toContain("allowFullScreen");
    // thumbnail click swaps to iframe (no autoplay before user intent)
    expect(src).toContain("youTubeThumbUrl(videoId)");
    expect(src).toContain("setPlaying(true)");
  });

  it("no dangerouslySetInnerHTML — video id only enters via React props", () => {
    expect(src).not.toContain("dangerouslySetInnerHTML");
  });
});
