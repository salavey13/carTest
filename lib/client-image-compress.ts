// /lib/client-image-compress.ts
//
// Shared client-side image compression utility.
// Extracted from app/franchize/components/PhotoUploadButton.tsx (I3 — avoid
// duplicating the canvas+toBlob logic across multiple upload surfaces).
//
// Used by:
//   - PhotoUploadButton.tsx (existing — passport/license OCR flow)
//   - RentalPhotoGallery.tsx (NEW — rental photo upload, I3)
//   - Future surfaces that need client-side resize before upload
//
// Pipeline:
//   1. Load file into <img> element
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

export interface CompressImageOptions {
  /** Max longest-edge in pixels (default 1400 — lowered from 1600 for smaller uploads). */
  maxSize?: number;
  /** JPEG quality 0-1 (default 0.70 — lowered from 0.80 for smaller uploads). */
  quality?: number;
}

/** Max input file size before compression (25 MB — raised from 10 MB in I4). */
export const MAX_INPUT_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Compress an image File client-side to a JPEG Blob.
 * Rejects if the file is > 25 MB (input guard, not compression output).
 *
 * I4 enhancement: limit raised from 10 MB → 25 MB because modern phones
 * (especially iPhones with HEIC) produce 10-12 MB photos. The compression
 * pipeline handles them fine — this is just a pre-read guard.
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

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    img.onload = () => {
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

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob"));
          }
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
