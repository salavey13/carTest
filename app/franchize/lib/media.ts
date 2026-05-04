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
