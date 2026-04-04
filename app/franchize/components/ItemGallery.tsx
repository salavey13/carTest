"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

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
}: ItemGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (images.length === 0) {
    return (
      <div
        className="flex h-64 w-full items-center justify-center px-4 text-center text-sm sm:h-72"
        style={{ color: "var(--item-muted-text, #888)", backgroundColor: "var(--item-card-bg, #111)" }}
      >
        Изображение скоро загрузим
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div
        ref={containerRef}
        tabIndex={disableKeyboardNav ? -1 : 0}
        className={`relative w-full outline-none ${getAspectRatioClass()}`}
        style={{ backgroundColor: "var(--item-card-bg, #000)" }}
      >
        <Image
          src={images[0]}
          alt={`${altText} 1`}
          fill
          sizes="(max-width: 1024px) 100vw, 42vw"
          className="object-cover"
          unoptimized
          priority
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} tabIndex={disableKeyboardNav ? -1 : 0} className={`relative w-full outline-none ${className}`}>
      {/* Main Image Container - FIXED: Added explicit aspect ratio class */}
      <div className={`relative w-full bg-black/25 ${getAspectRatioClass()}`}>
        <Image
          src={images[activeIndex]}
          alt={`${altText} ${activeIndex + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 42vw"
          className="object-cover"
          unoptimized
          priority={activeIndex === 0}
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
        <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm select-none pointer-events-none">
          {activeIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails Strip */}
      <div
        className="border-t px-3 pb-3 pt-3 sm:px-4"
        style={{ borderColor, backgroundColor: bgColor }}
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((url, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                aria-pressed={isActive}
                aria-label={`Показать фото ${index + 1}`}
                className={`relative aspect-[5/4] w-full overflow-hidden rounded-2xl border transition-all duration-200 ${
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
                  src={url}
                  alt={`${altText} ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 120px"
                  className="object-cover"
                  unoptimized
                  loading={index === 0 ? "eager" : "lazy"}
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