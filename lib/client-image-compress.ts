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
//   2. Compute scale so longest edge ≤ maxSize (default 1600px)
//   3. Draw to <canvas>
//   4. canvas.toBlob() with JPEG quality 0.80
//
// Server-side compression (in uploadRentalPhoto via sharp) re-compresses to
// max 1280px quality 0.75 — so the client pass is mainly to keep the upload
// payload small. The server pass is the canonical persisted version.

export interface CompressImageOptions {
  /** Max longest-edge in pixels (default 1600). */
  maxSize?: number;
  /** JPEG quality 0-1 (default 0.80). */
  quality?: number;
}

/**
 * Compress an image File client-side to a JPEG Blob.
 * Rejects if the file is > 10 MB (input guard, not compression output).
 */
export async function reduceImageResolution(
  file: File,
  options: CompressImageOptions = {},
): Promise<Blob> {
  const maxSize = options.maxSize ?? 1600;
  const quality = options.quality ?? 0.80;

  // Input size guard — reject anything > 10 MB before even reading
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Файл слишком большой (макс. 10 МБ до сжатия).");
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
