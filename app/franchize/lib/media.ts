export function normalizeBikeImageUrl(url: string): string {
  if (!url) return url;
  // Legacy variant filenames -> canonical numeric filenames expected by current storage conventions.
  return url
    .replace(/\/image_black_(\d+)\.(png|jpg|jpeg|webp)$/i, "/image_$1.$2")
    .replace(/\/image_white_(\d+)\.(png|jpg|jpeg|webp)$/i, "/image_$1.$2");
}

export function buildCandidateImageUrls(url: string): string[] {
  if (!url) return [];
  const normalized = normalizeBikeImageUrl(url);
  if (normalized === url) return [url];
  return [normalized, url];
}

/** Derive the 4:3 landscape variant URL from a catalog image URL.
 *  image_1.jpg → image_1_4x3.jpg (inserts _4x3 before the file extension).
 *  Used by ItemGallery and buy-page hero where the layout is wider than 9:16. */
export function imageUrl4x3(url: string): string {
  if (!url) return url;
  return url.replace(/(\.[a-zA-Z0-9]+)(\?|#|$)/, "_4x3$1$2");
}
