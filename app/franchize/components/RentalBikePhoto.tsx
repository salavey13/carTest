"use client";

/**
 * RentalBikePhoto
 * ──────────────────────────────────────────────────────────────────────────
 * Client Component wrapper for the bike photo on the rental page.
 *
 * WHY THIS EXISTS:
 *   The rental page (page.tsx) is an async Server Component. Server Components
 *   cannot pass event handlers (like onError) to DOM elements — Next.js throws:
 *     "Event handlers cannot be passed to Client Component props."
 *   The bike photo needs onError to gracefully hide the container when the
 *   image URL is broken (vehicle.image_url might be empty/invalid in production).
 *
 * Extracted to its own Client Component so the rest of the page stays SSR.
 */
interface RentalBikePhotoProps {
  src: string;
  alt: string;
  statusLabel: string;
  statusBadgeBg: string;
  statusBadgeText: string;
  rentalShortId?: string;
  borderColor: string;
}

export function RentalBikePhoto({
  src,
  alt,
  statusLabel,
  statusBadgeBg,
  statusBadgeText,
  rentalShortId,
  borderColor,
}: RentalBikePhotoProps) {
  return (
    <div className="rental-bike-photo relative rounded-2xl overflow-hidden border w-full" style={{ borderColor }}>
      <img
        src={src}
        alt={alt}
        // goodmorning-polish: portrait 9:16 on desktop, square on mobile (via .rental-bike-photo CSS)
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          // Hide image container if image fails to load (broken URL etc.)
          (e.currentTarget.parentElement as HTMLElement).style.display = "none";
        }}
      />
      {/* Status badge overlay */}
      <div className="absolute top-3 left-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md"
          style={{ backgroundColor: statusBadgeBg, color: statusBadgeText }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusBadgeText }} />
          {statusLabel}
        </span>
      </div>
      {/* Bike title overlay */}
      {alt && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm font-bold text-white truncate">{alt}</p>
          {rentalShortId && (
            <p className="text-[11px] text-white/70 font-mono">#{rentalShortId}</p>
          )}
        </div>
      )}
    </div>
  );
}
