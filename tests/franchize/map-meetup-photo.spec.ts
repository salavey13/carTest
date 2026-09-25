// tests/franchize/map-meetup-photo.spec.ts
//
// Task: «allow to add respective photo to map points (to be used for icon on
// map)» + reverse interlink «from map point to post on the wall» (map-riders,
// 2026-09-25).
//
// Verified:
//   · migration 20260925120000 adds map_rider_meetups.photo_url (idempotent);
//   · meetup marker wears the PHOTO first (avatar fallback preserved);
//   · meetup photo upload route: guard + subject + membership + creator-only,
//     640px/150KB marker budget, final wallpix path (no staging), photo_url
//     update with migration-hint on PGRST204;
//   · useMeetupCreator: photo upload after create, id-returning contract
//     (legacy truthiness preserved for RidersDrawer);
//   · MeetupCreateModal: photo optional, compressed client-side;
//   · wall reverse interlink: mapPointCompose prop → geotag (label = точка)
//     + only-if-empty text, nonce re-trigger;
//   · composer still purges the geotag after publish (no leaks to next post).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const MIGRATION = "supabase/migrations/20260925120000_meetup_photo_url.sql";
const UPLOAD_ROUTE = "app/api/map-riders/meetup-photo-upload/route.ts";
const CLIENT = "components/map-riders/MapRidersClientRefactored.tsx";
const HOOK = "hooks/useMeetupCreator.ts";
const MODAL = "components/map-riders/MeetupCreateModal.tsx";
const WALL = "app/franchize/[slug]/community/CommunityWallClient.tsx";
const REDUCER = "lib/map-riders-reducer.ts";

// ── migration ────────────────────────────────────────────────────────────────

describe("meetup photo_url migration", () => {
  const sql = read(MIGRATION);

  it("adds photo_url to map_rider_meetups, idempotently (additive-only porting discipline)", () => {
    expect(sql).toMatch(/alter table public\.map_rider_meetups/i);
    expect(sql).toMatch(/add column if not exists photo_url text/i);
  });

  it("documents the final wallpix path contract (no staging lifecycle)", () => {
    expect(sql).toMatch(/meetups\/<meetupId>\//i);
  });
});

// ── marker wiring (photo first, avatar fallback) ─────────────────────────────

describe("meetup marker photo priority", () => {
  const src = read(CLIENT);
  const reducer = read(REDUCER);

  it("MeetupPoint type carries photo_url (optional → backward-compatible with rows before migration)", () => {
    expect(reducer).toMatch(/photo_url\?: string \| null/);
  });

  it("imageUrl: meetup photo wins over creator avatar; both trimmed; null → FaLocationDot badge chain", () => {
    expect(src).toMatch(/imageUrl:\s*m\.photo_url\?\.trim\(\) \|\| m\.users\?\.avatar_url\?\.trim\(\) \|\| null/);
  });

  it("popup renders the photo when present (same pattern as wall-pin popups)", () => {
    expect(src).toMatch(/m\.photo_url\?\.trim\(\) \? \(/);
    expect(src).toMatch(/src=\{m\.photo_url\.trim\(\)\}/); // v3: <button>-обёртка a11y, точную вложенность не пиним
  });
});

// ── upload route (server-side contract) ──────────────────────────────────────

describe("meetup-photo-upload route", () => {
  const src = read(UPLOAD_ROUTE);

  it("guards the write: same map-riders auth contract as the meetups route", () => {
    expect(src).toMatch(/guardMapRidersWriteRequest\(request\)/);
    expect(src).toMatch(/userId !== guard\.subject/);
    expect(src).toMatch(/assertCrewMembership\(userId, crewSlug\)/);
  });

  it("is creator-only (photos are attached by the meetup author)", () => {
    expect(src).toMatch(/meetup\.created_by_user_id !== userId/);
    expect(src).toMatch(/"Фото к точке добавляет её автор"/);
  });

  it("marker budget: 640px ladder, 150 KB cap — not the wall's 1280/300 KB", () => {
    expect(src).toMatch(/DIMENSION_LADDER = \[640, 480, 384\]/);
    expect(src).toMatch(/MAX_SIZE_BYTES = 150 \* 1024/);
  });

  it("stores to the FINAL wallpix path meetups/<meetupId>/<uuid>.jpg (no staging janitor surprises)", () => {
    expect(src).toMatch(/WALLPHOTO_BUCKET/);
    expect(src).toMatch(/meetups\/\$\{meetupId\}\/\$\{randomUUID\(\)\.replace\(\/-\/g, ""\)\}\.jpg/);
    expect(src).not.toMatch(/staging\//);
  });

  it("writes photo_url back and returns the public URL", () => {
    expect(src).toMatch(/\.update\(\{ photo_url: photoUrl \}\)/);
    expect(src).toMatch(/wallPhotoPublicUrl\(storagePath\)/);
    expect(src).toMatch(/success: true,\s*\n\s*photoUrl/);
  });

  it("explains the un-applied migration instead of a cryptic PGRST204", () => {
    expect(src).toMatch(/PGRST204/);
    expect(src).toMatch(/миграция 20260925120000_meetup_photo_url не применена/);
  });

  it("rejects non-image and oversized uploads before sharp", () => {
    expect(src).toMatch(/ALLOWED_TYPES\.has\(file\.type\)/);
    expect(src).toMatch(/25 \* 1024 \* 1024/);
  });
});

// ── hook contract (photo upload + id return) ────────────────────────────────

describe("useMeetupCreator photo + id contract", () => {
  const src = read(HOOK);

  it("uploads the photo right after the meetup row is created", () => {
    expect(src).toMatch(/photoFile\?: File \| null/);
    expect(src).toMatch(/\/api\/map-riders\/meetup-photo-upload/);
    expect(src).toMatch(/if \(photoFile && meetupId\)/);
  });

  it("multipart request must NOT pin a JSON Content-Type (browser sets the boundary)", () => {
    expect(src).toMatch(/getMapRidersWriteHeaders\(false\)/);
  });

  it("returns the created meetup id; failed photo upload never rolls the meetup back", () => {
    expect(src).toMatch(/Promise<string \| null>/);
    expect(src).toMatch(/return meetupId \?\? null/);
    expect(src).toMatch(/toast\.warning/);
  });
});

// ── modal (photo optional, client-side compression) ──────────────────────────

describe("MeetupCreateModal", () => {
  const src = read(MODAL);

  it("submits (value, photoFile) — photo is optional", () => {
    expect(src).toMatch(/onSubmit: \(value: string, photoFile: File \| null\) => void/);
    expect(src).toMatch(/необязательно/);
  });

  it("compresses on the client with the same lib as the wall (1280 / q0.7)", () => {
    expect(src).toMatch(/reduceImageResolution\(file, \{ maxSize: MEETUP_PHOTO_MAX_EDGE, quality: 0\.7 \}\)/);
    expect(src).toMatch(/MEETUP_PHOTO_MAX_EDGE = 1280/);
  });

  it("revokes blob previews (no retained 10–25 MB sources)", () => {
    expect(src).toMatch(/URL\.revokeObjectURL/);
  });

  it("close resets BOTH photoFile and preview (codereview fix: no photo-less meetup with a visible preview)", () => {
    const effect = src.match(/else \{[\s\S]*?setPhotoFile\(null\);[\s\S]*?setPhotoPreviewUrl\(null\);[\s\S]*?\}/);
    expect(effect).not.toBeNull();
  });

  it("submit is gated on the same ≥2-char contract the hook enforces (photo survives a failed attempt)", () => {
    expect(src).toMatch(/const titleTooShort = value\.trim\(\)\.length < 2/);
    expect(src).toMatch(/disabled=\{saving \|\| compressing \|\| titleTooShort\}/);
    // submit() НЕ чистит фото: сброс делает только close-эффект (успех/отмена)
    const submitBody = src.match(/const submit = \(\) => \{[\s\S]*?\n  \};/);
    expect(submitBody?.[0]).not.toMatch(/setPhotoFile\(null\)/);
  });

  it("franchize client no longer imports the generic prompt modal (replaced here)", () => {
    expect(src).not.toContain("FranchizePromptModal");
  });
});

// ── reverse interlink (map point → wall post) ────────────────────────────────

describe("wall reverse interlink: mapPointCompose", () => {
  const wall = read(WALL);
  const src = read(CLIENT);

  it("map-riders popup button opens the wall composer with the point's coords + title", () => {
    expect(src).toMatch(/openWallComposeFromPoint\(\{ lat: m\.lat, lng: m\.lon, label: m\.title, text: m\.title \}\)/);
    expect(src).toMatch(/Пост на стене/); // v3: парная кнопка «Маршрут», текст короче
    expect(src).toMatch(/setActiveSnap\(0\.86\)/);
    expect(src).toMatch(/setSheetOpen\(true\)/);
  });

  it("mapPointCompose is passed into the wall client (in-page, no routing)", () => {
    expect(src).toMatch(/mapPointCompose=\{wallMapPointCompose\}/);
  });

  it("wall effect: geotag applied with the point's label; existing geotag is overwritten by explicit user action", () => {
    expect(wall).toMatch(/mapPointCompose\?: \{ lat: number; lng: number; label\?: string \| null; text\?: string \| null; nonce: number \} \| null/);
    expect(wall).toMatch(/applyGeoPoint\(mapPointCompose\.lat, mapPointCompose\.lng, mapPointCompose\.label \?\? null\)/);
  });

  it("wall effect: text prefill only into an EMPTY composer (never erases typing), nonce re-trigger", () => {
    expect(wall).toMatch(/\[mapPointCompose\?\.nonce\]/);
    expect(wall).toMatch(/prev\.trim\(\) \? prev : mapPointCompose\.text!\.trim\(\)/);
  });

  it("applyGeoPoint supports the label override (nearest-spot name still wins when no override)", () => {
    expect(wall).toMatch(/labelOverride\?\.trim\(\) \|\| \(spot \? spot\.name : formatGeoCoords\(lat, lng\)\)/);
  });

  it("publishing still clears the geotag (no leak into the next post)", () => {
    expect(wall).toMatch(/setGeoTag\(null\)/);
  });
});

// ── popup meta (interlink v2): author + relative time, wall-pin parity ──────

describe("meetup popup meta", () => {
  const src = read(CLIENT);

  it("shows who placed the point (riderDisplayName over joined users) and when", () => {
    expect(src).toContain("{riderDisplayName(m.users)}");
    expect(src).toContain("{formatRelativeTimeRu(m.created_at)}");
  });

  it("meta row renders only when creator or timestamp exist (defensive against sparse rows)", () => {
    expect(src).toContain("{m.users || m.created_at ? (");
  });

  it("keeps the compose button after the meta row (author info never hides the action)", () => {
    const popup = src.slice(src.indexOf("const meetupPoints = state.meetups.map"), src.indexOf("const routePoints ="));
    const metaIdx = popup.indexOf("formatRelativeTimeRu(m.created_at)");
    const btnIdx = popup.indexOf("Пост на стене");
    expect(metaIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeGreaterThan(-1);
    expect(metaIdx).toBeLessThan(btnIdx);
  });
});

// ── interlink v3: photo lightbox from popups (portal out of leaflet panes) ──

describe("map photo lightbox", () => {
  const src = read(CLIENT);
  const lightbox = read("components/map-riders/MapPhotoLightbox.tsx");

  it("portal renders to document.body (leaflet-pane stacking context cannot cover the screen)", () => {
    expect(lightbox).toContain("createPortal(");
    expect(lightbox).toContain("document.body");
    expect(lightbox).toMatch(/z-\[9999\]/);
  });

  it("closes on backdrop tap, ESC and swipe-down (>80px) — Telegram-safe gestures", () => {
    expect(lightbox).toContain('if (event.key === "Escape") onClose();');
    expect(lightbox).toContain("if (dragY > 80) onClose();");
    expect(lightbox).toContain('className="fixed inset-0 z-[9999]');
  });

  it("meetup popup photo opens the lightbox with the point title as caption", () => {
    expect(src).toMatch(/setMapLightbox\(\{ url: m\.photo_url!\.trim\(\), caption: m\.title \}\)/);
    expect(src).toMatch(/cursor-zoom-in/);
  });

  it("wall-pin popup photo opens the lightbox (label wins, excerpt fallback)", () => {
    expect(src).toContain("caption: pin.label || pin.excerpt.slice(0, 60)");
  });

  it("lightbox is rendered at the root next to the other franchize modals", () => {
    expect(src).toContain("<MapPhotoLightbox photo={mapLightbox} onClose={closeLightbox} />");
  });
});
