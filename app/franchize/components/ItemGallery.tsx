"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCandidateImageUrls, imageUrl4x3 } from "@/app/franchize/lib/media";
import { localImageSrc, handleImageError } from "@/lib/image-fallback";

export interface ItemGalleryProps {
  images: string[];
  activeIndex: number;
  onNavigate: (direction: -1 | 1) => void;
  onSelect: (index: number) => void;
  altText: string;
  borderColor: string;
  accentColor: string;
  bgColor: string;
  mainAspectRatio?: "16/11" | "16/9" | "21/10" | "4/3" | "1/1";
  disableKeyboardNav?: boolean;
  className?: string;
  /** Optional close button to render in bottom-right of main image */
  closeButton?: React.ReactNode;
  /** When true, images are loaded as their _4x3 landscape variant (AI-outpainted)
   *  which fits the wider gallery containers better than the default 9:16.
   *  Falls back to the original URL if the _4x3 variant 404s. */
  prefer4x3?: boolean;
}

export function ItemGallery({
  images,
  activeIndex,
  onNavigate,
  onSelect,
  altText,
  borderColor,
  accentColor,
  bgColor,
  mainAspectRatio = "16/11",
  disableKeyboardNav = false,
  className = "",
  closeButton,
  prefer4x3 = false,
}: ItemGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failedUrls, setFailedUrls] = useState<Record<string, true>>({});
  /** Tracks original URLs whose _4x3 variant failed (so we fall back to original). */
  const [failed4x3, setFailed4x3] = useState<Record<string, true>>({});

  /** Returns the _4x3 variant URL when prefer4x3 is active and the variant
   *  hasn't already failed; otherwise returns the original URL unchanged. */
  const srcFor = useCallback(
    (url: string): string => {
      if (!prefer4x3 || !url || failed4x3[url]) return url;
      return imageUrl4x3(url);
    },
    [prefer4x3, failed4x3],
  );

  const resolvedImages = useMemo(() => {
    const out: string[] = [];
    for (const raw of images) {
      for (const candidate of buildCandidateImageUrls(raw)) {
        if (!candidate || failedUrls[candidate]) continue;
        if (!out.includes(candidate)) out.push(candidate);
      }
    }
    return out;
  }, [images, failedUrls]);

  useEffect(() => {
    if (disableKeyboardNav || images.length <= 1) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate(1);
      }
    };

    const container = containerRef.current;
    container?.addEventListener("keydown", handleKeyDown);
    return () => container?.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onNavigate, disableKeyboardNav]);

  // Fixed: Properly handle all aspect ratio cases
  const getAspectRatioClass = useCallback(() => {
    switch (mainAspectRatio) {
      case "16/11":
        return "aspect-[16/11] sm:aspect-[16/9] lg:aspect-[2.15/1]";
      case "16/9":
        return "aspect-[16/9]";
      case "4/3":
        return "aspect-[4/3]";
      case "1/1":
        return "aspect-square";
      case "21/10":
        return "aspect-[21/10]";
      default:
        return "aspect-[16/11] sm:aspect-[16/9] lg:aspect-[2.15/1]";
    }
  }, [mainAspectRatio]);

  if (resolvedImages.length === 0) {
    return (
      <div
        className="flex h-64 w-full items-center justify-center px-4 text-center text-sm sm:h-72"
        style={{ color: "var(--item-muted-text, #888)", backgroundColor: "var(--item-card-bg, #111)" }}
      >
        Изображение скоро загрузим
      </div>
    );
  }

  if (resolvedImages.length === 1) {
    return (
      <div
        ref={containerRef}
        tabIndex={-1}
        aria-label={`Галерея ${altText}`}
        className={`relative w-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${getAspectRatioClass()}`}
        style={{ backgroundColor: "var(--item-card-bg, #000)" }}
      >
        <Image
          src={localImageSrc(srcFor(resolvedImages[0]))}
          alt={`${altText} 1`}
          fill
          sizes="(max-width: 1024px) 100vw, 42vw"
          className="object-cover"
          onError={handleImageError(srcFor(resolvedImages[0]))}
          loading="eager"
          priority
          onError={() => {
            const orig = resolvedImages[0];
            if (prefer4x3 && orig && !failed4x3[orig]) {
              setFailed4x3((prev) => ({ ...prev, [orig]: true }));
            }
          }}
        />
        {closeButton && (
          <div className="absolute bottom-3 right-3 z-30">
            {closeButton}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={disableKeyboardNav ? -1 : 0}
      role="region"
      aria-label={`Галерея ${altText}`}
      className={`relative w-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
    >
      {/* Main Image Container - FIXED: Added explicit aspect ratio class */}
      <div className={`relative w-full bg-black/25 ${getAspectRatioClass()}`}>
        <Image
          src={localImageSrc(srcFor(resolvedImages[activeIndex]))}
          alt={`${altText} ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 42vw"
          className="object-cover"
          onError={handleImageError(srcFor(resolvedImages[activeIndex]))}
          loading="eager"
          priority={activeIndex === 0}
          onError={() => {
            const orig = resolvedImages[activeIndex];
            if (prefer4x3 && orig && !failed4x3[orig]) {
              setFailed4x3((prev) => ({ ...prev, [orig]: true }));
            } else if (orig) {
              setFailedUrls((prev) => ({ ...prev, [orig]: true }));
            }
          }}
        />

        {/* Navigation Arrows */}
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
          aria-label="Предыдущее фото"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate(1)}
          className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95"
          aria-label="Следующее фото"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Image Counter Badge */}
        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm select-none pointer-events-none" aria-live="polite">
          {activeIndex + 1} / {resolvedImages.length}
        </div>

        {/* Close Button (optional) */}
        {closeButton && (
          <div className="absolute bottom-3 right-3 z-30">
            {closeButton}
          </div>
        )}
      </div>

      {/* Thumbnails Strip */}
      <div
        className="border-t px-3 pb-3 pt-3 sm:px-4"
        style={{ borderColor, backgroundColor: bgColor }}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="group" aria-label="Миниатюры фотографий">
          {resolvedImages.map((url, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                aria-pressed={isActive}
                aria-label={`Показать фото ${index + 1}`}
                className={`relative aspect-[5/4] w-full overflow-hidden rounded-2xl border transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isActive ? "scale-[0.98] opacity-100" : "opacity-85 hover:opacity-100 active:scale-[0.97]"
                }`}
                style={{
                  borderColor: isActive ? accentColor : borderColor,
                  boxShadow: isActive
                    ? `0 0 0 2px ${bgColor}, 0 0 0 4px ${accentColor}`
                    : "none",
                }}
              >
                <Image
                  src={localImageSrc(srcFor(url))}
                  alt={`${altText} ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 120px"
                  className="object-cover"
                  onError={handleImageError(srcFor(url))}
                  loading="lazy"
                  onError={() => {
                    if (prefer4x3 && !failed4x3[url]) {
                      setFailed4x3((prev) => ({ ...prev, [url]: true }));
                    } else {
                      setFailedUrls((prev) => ({ ...prev, [url]: true }));
                    }
                  }}
                />
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-2xl ring-2 ring-inset"
                    style={{ borderColor: accentColor }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
