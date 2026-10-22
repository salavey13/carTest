// /lib/client-image-compress.ts
//
// Shared client-side image compression utility.
// Extracted from app/franchize/components/PhotoUploadButton.tsx (I3 — avoid
// duplicating the canvas+toBlob logic across multiple upload surfaces).
//
// Used by:
//   - PhotoUploadButton.tsx (passport/license OCR flow)
//   - RentalPhotoGallery.tsx (rental photo upload, I3)
//   - StoragePhotos / CommunityWallClient / MeetupCreateModal / CarSubmissionForm
//   - app/rentals/[id]/page.tsx PhotoUploader (before/after rental photos)
//
// Pipeline:
//   1. Load file into <img> element
//      1b. HEIC/HEIF fallback: native <img> decode fails on Chrome / Android /
//          Firefox / Windows (Safari/iOS is the only engine that decodes HEIC
//          natively). When the file looks like HEIC (magic bytes, extension or
//          MIME) and native decode fails, we lazily load `heic2any` (libheif
//          wasm, ~1.6 MB chunk — only fetched on the fallback path) and convert
//          to JPEG before continuing. See HEIC-2026-10 note below.
//   2. Compute scale so longest edge ≤ maxSize (default 1400px — lowered from 1600
//      in I4 enhancement to produce smaller uploads)
//   3. Draw to <canvas>
//   4. canvas.toBlob() with JPEG quality 0.70 (lowered from 0.80 for smaller payload)
//
// Server-side compression (in uploadRentalPhoto via sharp) re-compresses to
// max 1280px quality 0.75 — so the client pass is mainly to keep the upload
// payload small. The server pass is the canonical persisted version.
//
// I4 enhancement: input limit raised from 10 MB → 25 MB (modern phones produce
// 10-12 MB HEIC/JPEG photos). The client-side compression brings them down to
// ~200-400 KB before upload, so the 25 MB limit is just the pre-compression guard.
//
// HEIC-2026-10: iPhone photos default to HEIC. Every upload surface used to
// hard-fail on non-Safari browsers with "Failed to load image" because <img>
// cannot decode HEIC there. Contract after the fix: reduceImageResolution()
// ALWAYS resolves with a JPEG-decodable Blob/File — a HEIC input is converted
// to a `.jpg` File first and never falls back to the original bytes.

export interface CompressImageOptions {
  /** Max longest-edge in pixels (default 1400 — lowered from 1600 for smaller uploads). */
  maxSize?: number;
  /** JPEG quality 0-1 (default 0.70 — lowered from 0.80 for smaller uploads). */
  quality?: number;
}

/** Max input file size before compression (25 MB — raised from 10 MB in I4). */
export const MAX_INPUT_FILE_SIZE = 25 * 1024 * 1024;

/** Quality for the heic2any HEIC → JPEG pass (kept high — the canvas resize pass re-compresses after). */
const HEIC_TO_JPEG_QUALITY = 0.92;

const HEIC_FILE_EXT_RE = /\.(heic|heif|hif)$/i;
const HEIC_MIME_RE = /^image\/hei[cf](-sequence)?$/i;
/**
 * ISO-BMFF `ftyp` major brands that identify HEIC/HEIF containers.
 * Offset 4..7 is the literal "ftyp", offset 8..11 the major brand.
 * (avif/tiff/jpeg are intentionally NOT here — they decode natively.)
 */
const HEIC_FTYP_BRANDS = new Set([
  "heic", "heix", "hevc", "hevx", // HEVC-coded still images
  "heim", "heis", "hevm", "hevs", // HEVC multi-image / sequences
  "mif1", "msf1",                 // generic HEIF containers (mime image/heif)
]);

/**
 * True when the file is (very likely) an HEIC/HEIF photo — the iPhone default
 * format. Detection is layered because Android & Windows frequently hand the
 * file an empty MIME or `application/octet-stream`:
 *   1. magic bytes — ISO-BMFF `ftyp` box brand (definitive)
 *   2. MIME type   — image/heic, image/heif (+ -sequence variants)
 *   3. extension   — .heic / .heif / .hif
 */
export async function isHeicFile(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (head.length >= 12 && String.fromCharCode(head[4], head[5], head[6], head[7]) === "ftyp") {
      const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
      if (HEIC_FTYP_BRANDS.has(brand)) return true;
    }
  } catch {
    // Blob.slice unavailable / zero-length — fall through to name+mime checks
  }
  return HEIC_MIME_RE.test(file.type) || HEIC_FILE_EXT_RE.test(file.name);
}

/**
 * Convert an HEIC/HEIF photo to a JPEG File using heic2any (libheif compiled
 * to wasm). The module is dynamically imported so the ~1.6 MB libheif chunk
 * is only downloaded by browsers that actually need it (Chrome/Android/
 * Firefox/Windows) — Safari/iOS takes the native <img> decode path and never
 * loads this code.
 */
export async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: HEIC_TO_JPEG_QUALITY,
    });
    const jpegBlob = Array.isArray(out) ? out[0] : out;
    if (!jpegBlob || jpegBlob.size === 0) {
      throw new Error("empty conversion output");
    }
    const baseName = (file.name.replace(/\.[^.]+$/, "") || "photo").slice(0, 80);
    return new File([jpegBlob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    throw new Error(
      "Не удалось конвертировать HEIC-фото. Сделай скриншот или выбери фото в формате JPG.",
    );
  }
}

/** Decode a Blob into an HTMLImageElement via an object URL (revokes it after). */
function decodeImageElement(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(source);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

/** canvas.toBlob() promisified (jsdom-safe: rejects instead of hanging on null). */
function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob"));
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Compress an image File client-side to a JPEG Blob.
 * Rejects if the file is > 25 MB (input guard, not compression output).
 *
 * I4 enhancement: limit raised from 10 MB → 25 MB because modern phones
 * (especially iPhones with HEIC) produce 10-12 MB photos.
 *
 * HEIC-2026-10: HEIC/HEIF inputs are transparently converted to JPEG (see
 * convertHeicToJpeg) when the browser cannot decode them natively — the
 * resolved value is then ALWAYS a JPEG, never the original HEIC bytes.
 */
export async function reduceImageResolution(
  file: File,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const maxSize = options.maxSize ?? 1400;
  const quality = options.quality ?? 0.70;

  // Input size guard — reject anything > 25 MB before even reading
  if (file.size > MAX_INPUT_FILE_SIZE) {
    throw new Error(`Файл слишком большой (${Math.round(file.size / 1024 / 1024)} МБ, макс. 25 МБ до сжатия).`);
  }

  let source: Blob | File = file;
  let heicConverted = false;

  let img: HTMLImageElement;
  try {
    img = await decodeImageElement(source);
  } catch (nativeError) {
    // Native decode failed. On Safari this basically never happens for real
    // photos; on Chrome/Android/Firefox/Windows it is the classic HEIC case.
    if (!(await isHeicFile(file))) {
      throw nativeError;
    }
    source = await convertHeicToJpeg(file);
    heicConverted = true;
    // Re-decode the converted JPEG. If THIS fails too, the file is genuinely
    // corrupt — the error propagates to the caller's toast.
    img = await decodeImageElement(source);
  }

  let { width, height } = img;

  // Resize if larger than maxSize on the longest edge
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Release the decoded bitmap before the (possibly slow) encode step
  img.src = "";

  const blob = await canvasToJpegBlob(canvas, quality);

  // CR fix: if compression made the file LARGER (e.g. small PNG → JPEG),
  // return the original file instead. This prevents the client-side pass
  // from increasing the upload payload.
  // HEIC exception: the original can never be returned — the server pipeline
  // and other browsers can't consume it, so we always ship the JPEG.
  if (!heicConverted && blob.size >= file.size) {
    return file;
  }
  return blob;
}
