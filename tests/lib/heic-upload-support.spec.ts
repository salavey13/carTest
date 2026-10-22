// tests/lib/heic-upload-support.spec.ts
//
// HEIC-2026-10: iPhone photos default to HEIC; the shared client compressor
// (lib/client-image-compress.ts) used to hard-fail on every browser except
// Safari ("Failed to load image") because <img> cannot decode HEIC there.
//
// Covered:
//   1. Unit: isHeicFile() layered detection — ISO-BMFF ftyp magic brands,
//      MIME types, extensions (Android/Windows often send empty MIME).
//   2. Wiring/source assertions:
//      - shared lib lazily imports heic2any and never returns original HEIC bytes;
//      - PhotoUploadButton (doc OCR flow) consumes the shared lib, no local copy;
//      - /rentals/[id] PhotoUploader compresses before the raw uploadSingleImage
//        (previously stored raw .heic in the public `rentals` bucket);
//      - accept=".heic,.heif" on all 8 upload inputs;
//      - package.json carries the heic2any dependency.
//
// Run: npx vitest run tests/lib/heic-upload-support.spec.ts

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isHeicFile, MAX_INPUT_FILE_SIZE } from "@/lib/client-image-compress";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Build a File from byte chunks with an explicit name/type (jsdom-safe). */
function fileOf(parts: (number[] | string)[], name: string, type = ""): File {
  const u8 = parts.flatMap((p) =>
    typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p,
  );
  return new File([new Uint8Array(u8)], name, { type });
}

// ISO-BMFF: bytes 4..7 = "ftyp", bytes 8..11 = major brand
const ftypBox = (brand: string) => [
  0x00, 0x00, 0x00, 0x18, ..."ftyp".split("").map((c) => c.charCodeAt(0)),
  ...brand.split("").map((c) => c.charCodeAt(0)),
  0x00, 0x00, 0x00, 0x00,
];

describe("isHeicFile — layered detection (magic bytes → MIME → extension)", () => {
  it("detects HEVC-coded HEIC brands (heic/heix/hevc/hevx) by magic bytes", async () => {
    for (const brand of ["heic", "heix", "hevc", "hevx"]) {
      const f = fileOf([ftypBox(brand)], "IMG_0001", "application/octet-stream");
      expect(await isHeicFile(f), `brand ${brand}`).toBe(true);
    }
  });

  it("detects generic HEIF containers (mif1/msf1) by magic bytes", async () => {
    for (const brand of ["mif1", "msf1"]) {
      const f = fileOf([ftypBox(brand)], "IMG_0002", "");
      expect(await isHeicFile(f), `brand ${brand}`).toBe(true);
    }
  });

  it("detects HEIC by extension when MIME is empty (Android/Windows pickers)", async () => {
    expect(await isHeicFile(fileOf([[0x00]], "photo.HEIC", ""))).toBe(true);
    expect(await isHeicFile(fileOf([[0x00]], "photo.heif", ""))).toBe(true);
    expect(await isHeicFile(fileOf([[0x00]], "photo.hif", ""))).toBe(true);
  });

  it("detects HEIC by MIME even with a wrong extension", async () => {
    expect(await isHeicFile(fileOf([[0x00]], "photo.bin", "image/heic"))).toBe(true);
    expect(await isHeicFile(fileOf([[0x00]], "photo.bin", "image/heif"))).toBe(true);
    expect(await isHeicFile(fileOf([[0x00]], "photo.bin", "image/heic-sequence"))).toBe(true);
  });

  it("does NOT flag regular files: JPEG/PNG/WebP bytes, mp4 brand, plain names", async () => {
    const jpeg = fileOf([[0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]], "IMG_0003.jpg", "image/jpeg");
    expect(await isHeicFile(jpeg)).toBe(false);

    const mp4 = fileOf([ftypBox("isom")], "clip.mp4", "video/mp4");
    expect(await isHeicFile(mp4)).toBe(false);

    const png = fileOf([[0x89, 0x50, 0x4e, 0x47]], "shot.png", "image/png");
    expect(await isHeicFile(png)).toBe(false);
  });
});

describe("shared compressor keeps its public contract", () => {
  const lib = read("lib/client-image-compress.ts");

  it("input guard stays at 25 MB (I4)", () => {
    expect(MAX_INPUT_FILE_SIZE).toBe(25 * 1024 * 1024);
    expect(lib).toContain("25 МБ до сжатия");
  });

  it("lazily imports heic2any (chunk fetched only on the HEIC fallback path)", () => {
    expect(lib).toContain('await import("heic2any")');
    // no top-level static import — must stay out of every page's initial bundle
    expect(lib).not.toMatch(/from\s+"heic2any"/);
  });

  it("converts HEIC to JPEG and NEVER falls back to the original HEIC bytes", () => {
    expect(lib).toContain('toType: "image/jpeg"');
    // the "compression made it bigger → return original" CR fix is gated on !heicConverted
    expect(lib).toContain("!heicConverted && blob.size >= file.size");
    expect(lib).toContain('`${baseName}.jpg`');
  });

  it("tries native <img> decode first (Safari stays wasm-free and fast)", () => {
    expect(lib.indexOf("decodeImageElement(source)")).toBeGreaterThan(-1);
    expect(lib).toContain("isHeicFile(file)");
  });
});

describe("upload surfaces accept & convert HEIC", () => {
  it("PhotoUploadButton (doc OCR flow) uses the shared lib — local copy removed", () => {
    const src = read("app/franchize/components/PhotoUploadButton.tsx");
    expect(src).toContain('from "@/lib/client-image-compress"');
    expect(src).toContain("reduceImageResolution(file, { maxSize: 1920, quality: 0.85 })");
    // the duplicated pre-HEIC canvas implementation must be gone
    expect(src).not.toContain("async function reduceImageResolution");
    // HEIC files from Android arrive with empty MIME — extension fallback required
    expect(src).toContain("looksLikeImage(file)");
    expect(src).toContain('accept="image/*,.heic,.heif"');
  });

  it("/rentals/[id] PhotoUploader compresses BEFORE the raw uploadSingleImage call", () => {
    const src = read("app/rentals/[id]/page.tsx");
    expect(src).toContain("from '@/lib/client-image-compress'");
    expect(src).toContain("await reduceImageResolution(file)");
    // upload payload is renamed to .jpg + image/jpeg (was: raw .heic into the bucket)
    expect(src).toContain("file.name.replace(/\\.[^.]+$/, '.jpg')");
    expect(src).toContain("type: 'image/jpeg'");
    expect(src).toContain('accept="image/*,.heic,.heif"');
  });

  it("RentalPhotoGallery input accepts heic/heif mimes AND extensions", () => {
    const src = read("app/franchize/components/RentalPhotoGallery.tsx");
    expect(src).toContain(
      'accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"',
    );
  });

  it("wall / storage / meetup / car-form inputs accept .heic,.heif", () => {
    expect(read("app/franchize/[slug]/community/CommunityWallClient.tsx"))
      .toContain('accept="image/*,.heic,.heif"');
    expect(read("app/franchize/[slug]/storage/StorageBikeStoryClient.tsx"))
      .toContain('accept="image/*,.heic,.heif"');
    expect(read("app/franchize/[slug]/storage/StorageWallClient.tsx"))
      .toContain('accept="image/*,.heic,.heif"');
    expect(read("components/map-riders/MeetupCreateModal.tsx"))
      .toContain('accept="image/*,.heic,.heif"');
    expect(read("components/CarSubmissionForm.tsx"))
      .toContain('accept="image/*,.heic,.heif"');
  });

  it("meetup modal validates images by extension too (empty MIME on Android)", () => {
    const src = read("components/map-riders/MeetupCreateModal.tsx");
    expect(src).toContain(
      "!file.type.startsWith(\"image/\") && !/\\.(jpe?g|png|webp|heic|heif|hif)$/i.test(file.name)",
    );
  });

  it("heic2any is a runtime dependency", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.heic2any).toBeDefined();
  });
});
