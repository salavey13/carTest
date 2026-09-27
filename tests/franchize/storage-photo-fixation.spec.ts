// tests/franchize/storage-photo-fixation.spec.ts
// 2026-09-27 — boss: «photos — acceptance/return фотофиксация into the event
// timeline». Covers the v4 photo layer:
//   · lib pure pieces: sanitizeStoragePhotoPaths (strict bike-folder gate),
//     storagePhotoPublicUrl, storagePhotoPathRe, 'photo' event label
//   · migration v3 (photo_paths jsonb, CHECK widened with 'photo', storagepix
//     bucket re-assert + public read policy)
//   · upload route: identity ladder, staff-or-owner gate, sharp ladder,
//     bikes/<bikeId>/<32hex>.jpg path, quota, dead-reference guard
//   · server actions: photos on updateStorageBikeStatusAction (sanitize +
//     event photo_paths + TG line), addStorageBikePhotosAction gates, pre-v3
//     event-survival retry, photo_paths in both events selects
//   · shared StoragePhotos pieces + wall/story wiring (panels, controls,
//     timeline grids)
//   · report builder: 📸 counts per event + summary line

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STORAGE_EVENT_TYPE_LABELS,
  STORAGE_PHOTOS_MAX,
  STORAGE_PHOTO_BUCKET,
  STORAGE_PHOTO_WORTHY_TARGETS,
  sanitizeStoragePhotoPaths,
  storageEventLabel,
  storagePhotoPathRe,
  storagePhotoPublicUrl,
  type StorageBikeVM,
} from "@/app/franchize/lib/storage";
import { buildStorageBikeReport } from "@/app/franchize/lib/storage-bike-report";

const read = (p: string) => readFileSync(p, "utf8");

const baseEvent = (over: Partial<StorageBikeVM["events"][number]> = {}): StorageBikeVM["events"][number] => ({
  id: 1,
  type: "created",
  status: null,
  actorName: "Экипаж",
  message: "Владелец добавил байк вручную",
  createdAt: "2026-09-27T10:00:00Z",
  photoUrls: [],
  photoPaths: [],
  ...over,
});

// ── 1. lib pure pieces ───────────────────────────────────────────────────────

describe("storage photo lib", () => {
  const bikeId = "123e4567-e89b-12d3-a456-426614174000";
  const good = `bikes/${bikeId}/0123456789abcdef0123456789abcdef.jpg`;

  it("labels the photo event in Russian", () => {
    expect(STORAGE_EVENT_TYPE_LABELS.photo).toBe("Фотофиксация");
    expect(storageEventLabel("photo")).toBe("Фотофиксация");
  });

  it("exposes the storagepix bucket + wall-composer photo cap + shared move targets", () => {
    expect(STORAGE_PHOTO_BUCKET).toBe("storagepix");
    expect(STORAGE_PHOTOS_MAX).toBe(6);
    expect(STORAGE_PHOTO_WORTHY_TARGETS).toEqual(["in_storage", "returned"]);
  });

  it("storagePhotoPathRe accepts exactly the route's shape", () => {
    expect(storagePhotoPathRe(bikeId).test(good)).toBe(true);
    // another bike's folder — rejected (cross-bike injection)
    expect(storagePhotoPathRe(bikeId).test("bikes/999e4567-e89b-12d3-a456-426614174000/0123456789abcdef0123456789abcdef.jpg")).toBe(false);
    // traversal / different ext / subfolder
    expect(storagePhotoPathRe(bikeId).test(`bikes/${bikeId}/../../wallpix/staging/x.jpg`)).toBe(false);
    expect(storagePhotoPathRe(bikeId).test(`bikes/${bikeId}/0123456789abcdef0123456789abcdef.png`)).toBe(false);
    expect(storagePhotoPathRe(bikeId).test(`bikes/${bikeId}/sub/0123456789abcdef0123456789abcdef.jpg`)).toBe(false);
    // short / non-hex filename
    expect(storagePhotoPathRe(bikeId).test(`bikes/${bikeId}/short.jpg`)).toBe(false);
  });

  it("sanitizeStoragePhotoPaths: absent → [], valid → deduped, junk → null", () => {
    expect(sanitizeStoragePhotoPaths(undefined, bikeId)).toEqual([]);
    expect(sanitizeStoragePhotoPaths(null, bikeId)).toEqual([]);
    expect(sanitizeStoragePhotoPaths([], bikeId)).toEqual([]);
    expect(sanitizeStoragePhotoPaths([good, good], bikeId)).toEqual([good]);

    expect(sanitizeStoragePhotoPaths("not-an-array", bikeId)).toBeNull();
    expect(sanitizeStoragePhotoPaths([42], bikeId)).toBeNull();
    expect(sanitizeStoragePhotoPaths([`bikes/999e4567-e89b-12d3-a456-426614174000/0123456789abcdef0123456789abcdef.jpg`], bikeId)).toBeNull();
    expect(sanitizeStoragePhotoPaths([good], bikeId)).toEqual([good]);
    // cap: 7 photos → null (STORAGE_PHOTOS_MAX = 6)
    const seven = Array.from({ length: STORAGE_PHOTOS_MAX + 1 }, () => good);
    expect(sanitizeStoragePhotoPaths(seven, bikeId)).toBeNull();
  });

  it("storagePhotoPublicUrl builds the public storagepix URL (env-driven)", () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co/";
    try {
      expect(storagePhotoPublicUrl(good)).toBe(
        `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/storagepix/${good}`,
      );
      expect(storagePhotoPublicUrl("")).toBe("");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });
});

// ── 2. migration v3 ──────────────────────────────────────────────────────────

describe("winter storage v3 migration", () => {
  const sql = read("supabase/migrations/20260927140000_winter_storage_v3.sql");

  it("adds photo_paths jsonb with a safe default", () => {
    expect(sql).toMatch(/add column if not exists photo_paths jsonb not null default '\[\]'/);
  });

  it("widens the event-type CHECK with 'photo' (drop + re-add, idempotent)", () => {
    expect(sql).toMatch(/drop constraint if exists storage_bike_events_type_check/);
    expect(sql).toMatch(/check \(type in \('created', 'status_changed', 'note', 'doc', 'payment', 'owner_linked', 'photo'\)\)/);
  });

  it("declares the public storagepix bucket (wallpix recipe, re-assert on conflict)", () => {
    expect(sql).toMatch(/'storagepix'/);
    expect(sql).toMatch(/on conflict \(id\) do update/i);
    expect(sql).toMatch(/5242880/);
    expect(sql).toMatch(/image\/jpeg/);
  });

  it("public read policy only — no anon write policies", () => {
    expect(sql).toMatch(/for select/i);
    expect(sql).not.toMatch(/for insert|for update|for delete/i);
    expect(sql).toMatch(/MANUAL MIGRATION/);
  });
});

// ── 3. upload route ──────────────────────────────────────────────────────────

describe("storage-photo-upload route", () => {
  const src = read("app/api/franchize/storage-photo-upload/route.ts");

  it("verifies identity via signed cookie with the initData fallback", () => {
    expect(src).toMatch(/verifyTelegramActorCookieValue/);
    expect(src).toMatch(/computeTelegramWebAppHash/);
    expect(src).toMatch(/isTelegramInitDataFresh/);
    expect(src).toMatch(/401/);
  });

  it("gates writes to staff OR the bike's owner (crew_slug scoped)", () => {
    expect(src).toMatch(/owner_user_id/);
    expect(src).toMatch(/crew_slug/);
    expect(src).toMatch(/crew_members/);
    expect(src).toMatch(/membership_status/, "active membership check");
    expect(src).toMatch(/403/);
  });

  it("compresses with the wall's sharp ladder to ≤ 300 KB", () => {
    expect(src).toMatch(/DIMENSION_LADDER = \[1280, 1080, 896\]/);
    expect(src).toMatch(/MAX_SIZE_BYTES = 300 \* 1024/);
    expect(src).toMatch(/mozjpeg: true/);
    expect(src).toMatch(/\.rotate\(\)/);
  });

  it("reuses the wall's initData helper and hints when the v3 bucket is missing", () => {
    expect(src).toMatch(/parseTelegramInitDataUser/);
    expect(src).toMatch(/Бакет фото не найден — примените миграцию v3 \(storagepix\)\./);
  });

  it("uploads straight into the bike's folder and self-checks the path regex", () => {
    expect(src).toMatch(/bikes\/\$\{bikeId\}/);
    expect(src).toMatch(/storagePhotoPathRe\(bikeId\)\.test\(storagePath\)/);
    expect(src).toMatch(/\.remove\(\[storagePath\]\)/, "dead reference removed, not handed to the client");
  });

  it("keeps a soft per-bike quota (429 burst guard)", () => {
    expect(src).toMatch(/BIKE_FOLDER_QUOTA = 60/);
    expect(src).toMatch(/429/);
  });
});

// ── 4. server actions ────────────────────────────────────────────────────────

describe("storage actions — photo wiring", () => {
  const src = read("app/franchize/server-actions/storage-bikes.ts");

  it("both event selects read photo_paths", () => {
    const selects = src.match(/select\("id, bike_id, type, status, actor_name, message, created_at[^"]*"\)/g) ?? [];
    expect(selects.length).toBe(2);
    for (const s of selects) expect(s).toContain("photo_paths");
  });

  it("mapBike resolves public photo URLs + raw paths into the VM", () => {
    expect(src).toMatch(/const paths = \(e\.photo_paths \?\? \[\]\)\.filter\(Boolean\);/);
    expect(src).toMatch(/photoUrls: paths\.map\(storagePhotoPublicUrl\)\.filter\(Boolean\),/);
    expect(src).toMatch(/photoPaths: paths,/);
  });

  it("status move: sanitize gate + photo_paths on the event + TG count line", () => {
    expect(src).toMatch(/photos: z\.unknown\(\)\.optional\(\)/);
    expect(src).toMatch(/sanitizeStoragePhotoPaths\(parsed\.data\.photos, bikeId\)/);
    expect(src).toMatch(/Фото: максимум \$\{STORAGE_PHOTOS_MAX\} на событие/);
    expect(src).toMatch(/📸 Фотофиксация: \$\{photoPaths\.length\} фото — в карточке хранения/);
    // the status_changed event carries the paths
    expect(src).toMatch(/type: "status_changed",[\s\S]{0,400}photoPaths,/);
  });

  it("addStorageBikePhotosAction: staff-or-owner, ≥1 photo, 'photo' event, note-style routing", () => {
    expect(src).toMatch(/export async function addStorageBikePhotosAction/);
    expect(src).toMatch(/type: "photo"/);
    expect(src).toMatch(/Прикрепите хотя бы одно фото\./);
    expect(src).toMatch(/loadStoryBike\(\{ slug, bikeId, actorUserId, initData \}\)/);
    // staff → owner hears; owner → crew hears (mirror of the note routing)
    expect(src).toMatch(/alsoChatIds: isStaff \? \(loaded\.row\.owner_user_id \? \[String\(loaded\.row\.owner_user_id\)\] : \[\]\) : \[senderId\]/);
  });

  it("pre-v3 survival: PGRST204 / 42703 / message regex retries the legacy insert", () => {
    // PostgREST reports a missing INSERT column as PGRST204 (schema cache),
    // not the raw 42703 — boss review R1 finding #1.
    expect(src).toMatch(/code === "42703" \|\| code === "PGRST204" \|\| \/photo_paths\/i\.test\(error\.message\)/);
    expect(src).toMatch(/event saved without photos/);
    expect(src).toMatch(/photosDropped: \(params\.photoPaths\?\.length \?\? 0\) > 0/);
    // unrelated DB failure is honest too: saved:false, not a silent event loss
    expect(src).toMatch(/\{ saved: false, photosDropped: false \}/);
  });

  it("honest degradation: both photo actions return a warning when photos were dropped", () => {
    const updateAction = src.slice(src.indexOf("updateStorageBikeStatusAction"), src.indexOf("addStorageBikeNoteSchema"));
    expect(updateAction).toMatch(/warning = "Перемещение сохранено, но фото не прикрепились/);
    expect(updateAction).toMatch(/warning = "Перемещение сохранено, но событие не записалось в историю/);
    expect(updateAction).toMatch(/return \{ success: true, warning \};/);
    const photoAction = src.slice(src.indexOf("addStorageBikePhotosAction"), src.indexOf("deleteStorageBikePhotoSchema"));
    expect(photoAction).toMatch(/Событие сохранено, но фото не прикрепились/);
  });

  it("deleteStorageBikePhotoAction: staff-or-owner, path gate, event strip + object remove + notify", () => {
    expect(src).toMatch(/export async function deleteStorageBikePhotoAction/);
    const body = src.slice(src.indexOf("deleteStorageBikePhotoSchema"), src.indexOf("getStorageDocUrlAction"));
    expect(body).toMatch(/loadStoryBike\(\{ slug, bikeId, actorUserId, initData \}\)/);
    expect(body).toMatch(/storagePhotoPathRe\(bikeId\)\.test\(photoPath\)/);
    expect(body).toMatch(/\.contains\("photo_paths", \[photoPath\]\)/);
    expect(body).toMatch(/\.from\(STORAGE_PHOTO_BUCKET\)\.remove\(\[photoPath\]\)/);
    expect(body).toMatch(/Фото удалено из истории/);
  });
});

// ── 5. UI wiring ─────────────────────────────────────────────────────────────

describe("storage photo UI wiring", () => {
  const shared = read("app/franchize/[slug]/storage/StoragePhotos.tsx");
  const story = read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx");
  const wall = read("app/franchize/[slug]/storage/StorageWallClient.tsx");

  it("shared hook compresses client-side and posts to the storage upload route", () => {
    expect(shared).toMatch(/reduceImageResolution\(file, \{ maxSize: 1280, quality: 0\.7 \}\)/);
    expect(shared).toMatch(/\/api\/franchize\/storage-photo-upload/);
    expect(shared).toMatch(/form\.set\("bikeId", bikeId\)/);
    expect(shared).toMatch(/getTelegramInitData\(\)/);
    expect(shared).toMatch(/STORAGE_PHOTOS_MAX/);
  });

  it("story: accept/return moves open the photo panel; cancel stays single-tap", () => {
    expect(story).toMatch(/const withPhotos = STORAGE_PHOTO_WORTHY_TARGETS\.includes\(target\);/);
    expect(story).toMatch(/photos: upload\.paths\.length > 0 \? upload\.paths : undefined/);
    expect(story).toMatch(/StoragePhotoStrip/);
    expect(story).toMatch(/Фото состояния — до 6 шт\./);
    expect(story).toMatch(/if \(result\.warning\) toast\.warning\(result\.warning\);/);
  });

  it("story: standalone Фотофиксация control for staff AND owner", () => {
    expect(story).toMatch(/function PhotoFixationControl/);
    expect(story).toMatch(/addStorageBikePhotosAction/);
    // wired in the staff section and the owner section
    expect(story).toMatch(/<PhotoFixationControl slug=\{slug\} bikeId=\{story\.id\} onDone=\{fetchStory\} T=\{T\} staffLabel \/>/);
    expect(story).toMatch(/<PhotoFixationControl slug=\{slug\} bikeId=\{story\.id\} onDone=\{fetchStory\} T=\{T\} \/>/);
  });

  it("story timeline renders photo grids with delete affordance (purple dot for photo events)", () => {
    expect(story).toMatch(/event\.type === "photo"\s*\?\s*"#8b5cf6"/);
    expect(story).toMatch(/<StorageEventPhotoGrid paths=\{event\.photoPaths\} T=\{T\} onDelete=\{onDeletePhoto\} \/>/);
    expect(story).toMatch(/deleteStorageBikePhotoAction/);
    expect(story).toMatch(/window\.confirm\("Удалить это фото из истории хранения\?"\)/);
  });

  it("wall: photo panel on accept/return (shared targets, draft reset on switch) + timeline grid", () => {
    expect(wall).toMatch(/STORAGE_PHOTO_WORTHY_TARGETS\.includes\(target\)/);
    expect(wall).toMatch(/handleMoveTap/);
    expect(wall).toMatch(/confirmMoveWithPhotos/);
    // carry-over guard: switching/cancelling the target resets the draft
    expect(wall).toMatch(/if \(moveTarget !== target\) \{\s*upload\.reset\(\);\s*setMoveMessage\(""\);/s);
    expect(wall).toMatch(/📸 \$\{event\.photoUrls\.length\}/);
    expect(wall).toMatch(/<StorageEventPhotoGrid paths=\{event\.photoPaths\} T=\{T\} size=\{44\} \/>/);
  });

  it("event photo grid opens the full-size public URL in a new tab; delete is a caller concern", () => {
    expect(shared).toMatch(/target="_blank"/);
    expect(shared).toMatch(/rel="noopener noreferrer"/);
    expect(shared).toMatch(/onDelete\?\: \(photoPath: string\) => void/);
    expect(shared).toMatch(/storagePhotoPublicUrl\(path\)/);
  });
});

// ── 6. report ────────────────────────────────────────────────────────────────

describe("storage report — photo counts", () => {
  const bikeId = "123e4567-e89b-12d3-a456-426614174000";
  const url = (n: number) => `https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/storagepix/bikes/${bikeId}/${n}.jpg`;

  const baseBike = (events: StorageBikeVM["events"]): StorageBikeVM => ({
    id: "b1",
    createdAt: "2026-09-20T10:00:00Z",
    status: "returned",
    ownerName: "Михалёв Роман Викторович",
    ownerPhone: "+7 909 283-82-49",
    bikeTitle: "SYM LM 25",
    regNumber: "1110 XX52",
    vin: "RFGLM30WYB5008081",
    year: 2011,
    color: "чёрный",
    mileageKm: 35400,
    accessories: "Кофр и чехол",
    estimatedValueRub: 200000,
    monthlyPriceRub: 2000,
    totalPriceRub: 15000,
    seasonStart: "2026-10-15",
    seasonEnd: "2027-06-01",
    monthsLabel: "7,5 месяца",
    storageAddress: "Стригинский переулок, 13Б",
    noticeAddress: "",
    orderId: null,
    docPath: null,
    pepSigned: true,
    paidUntil: "2027-06-01",
    source: "checkout",
    events,
  });

  it("marks photo counts per event row and in the summary line", () => {
    const report = buildStorageBikeReport({
      bike: baseBike([
        baseEvent({ id: 2, type: "status_changed", status: "in_storage", message: "", photoUrls: [url(1), url(2), url(3)] }),
        baseEvent({ id: 3, type: "photo", message: "Осмотр после оттепели", photoUrls: [url(4)] }),
        baseEvent({ id: 4, type: "status_changed", status: "returned", message: "", photoUrls: [url(5), url(6)] }),
      ]),
      crewName: "VIP BIKE",
      nowMs: Date.parse("2026-09-27T12:00:00Z"),
    });

    expect(report.markdown).toContain("Фотофиксация: **6 фото** (приём — 3, возврат — 2, остальное — осмотры)");
    expect(report.markdown).toContain("Статус: 🧊 На хранении · 📸 3");
    expect(report.markdown).toContain("Статус: 🤝 Возвращён · 📸 2");
    expect(report.markdown).toContain("Фотофиксация · 📸 1");
  });

  it("photo summary counts the FULL history, not the truncated slice", () => {
    // boss review R1 finding #5 — totals claim «всего», truncation must not lie
    const reportSrc = read("app/franchize/lib/storage-bike-report.ts");
    expect(reportSrc).toMatch(/const photosTotal = photoCount\(events\);/);
    expect(reportSrc.indexOf("const rows = truncated > 0")).toBeLessThan(reportSrc.indexOf("const photosTotal = photoCount(events)"));
  });

  it("photo-less report has no photo lines (honest zero)", () => {
    const report = buildStorageBikeReport({
      bike: baseBike([baseEvent({ id: 2, type: "note", message: "позвонить владельцу" })]),
      crewName: "VIP BIKE",
      nowMs: Date.parse("2026-09-27T12:00:00Z"),
    });
    expect(report.markdown).not.toContain("Фотофиксация:");
    expect(report.markdown).not.toContain("📸");
  });
});
