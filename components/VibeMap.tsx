"use client";

import Image from "next/image";
import { motion, useMotionValue } from "framer-motion";
import { VibeContentRenderer } from "./VibeContentRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { useGesture } from "@use-gesture/react";
import { project, PointOfInterest, MapBounds } from "@/lib/map-utils";

interface VibeMapProps {
  points: PointOfInterest[];
  bounds: MapBounds;
  imageUrl?: string;
  highlightedPointId?: string | null;
  className?: string;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
}

type Size = { width: number; height: number };

type RenderBox = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

const DEFAULT_VIBE_MAP_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getRenderBox(container: Size, image: Size): RenderBox {
  const safeImageWidth = Math.max(1, image.width);
  const safeImageHeight = Math.max(1, image.height);
  const imageRatio = safeImageWidth / safeImageHeight;
  const containerRatio = Math.max(1, container.width) / Math.max(1, container.height);

  if (imageRatio > containerRatio) {
    const width = container.width;
    const height = width / imageRatio;
    return { width, height, offsetX: 0, offsetY: (container.height - height) / 2 };
  }

  const height = container.height;
  const width = height * imageRatio;
  return { width, height, offsetX: (container.width - width) / 2, offsetY: 0 };
}

function getDragLimits(container: Size, image: Size, scale: number) {
  const render = getRenderBox(container, image);
  const scaledWidth = render.width * scale;
  const scaledHeight = render.height * scale;

  return {
    maxX: Math.max(0, (scaledWidth - container.width) / 2),
    maxY: Math.max(0, (scaledHeight - container.height) / 2),
  };
}

export function VibeMap({
  points,
  bounds,
  imageUrl,
  highlightedPointId,
  className,
  isEditable = false,
  onMapClick,
}: VibeMapProps) {
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [imageSize, setImageSize] = useState<Size>({ width: 1, height: 1 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const containerSize: Size = {
    width: mapContainerRef.current?.offsetWidth ?? 1,
    height: mapContainerRef.current?.offsetHeight ?? 1,
  };

  const renderedImageBox = getRenderBox(containerSize, imageSize);

  const syncViewState = useCallback((next: { x: number; y: number; scale: number }) => {
    setViewState(next);
    x.set(next.x);
    y.set(next.y);
  }, [x, y]);

  const clampTranslation = useCallback((nextX: number, nextY: number, nextScale: number) => {
    if (!mapContainerRef.current) {
      return { x: nextX, y: nextY };
    }

    const limits = getDragLimits(
      { width: mapContainerRef.current.offsetWidth, height: mapContainerRef.current.offsetHeight },
      imageSize,
      nextScale,
    );

    return {
      x: clamp(nextX, -limits.maxX, limits.maxX),
      y: clamp(nextY, -limits.maxY, limits.maxY),
    };
  }, [imageSize]);

  useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
        const clamped = clampTranslation(dx, dy, viewState.scale);
        syncViewState({ ...viewState, ...clamped });
      },
      onPinch: ({ offset: [rawScale] }) => {
        const nextScale = clamp(rawScale, 1, 6);
        const clamped = clampTranslation(viewState.x, viewState.y, nextScale);
        syncViewState({ scale: nextScale, ...clamped });
      },
    },
    {
      target: mapContainerRef,
      eventOptions: { passive: false },
      drag: { from: () => [viewState.x, viewState.y], preventDefault: true },
      pinch: { from: () => [viewState.scale, 0] },
    },
  );

  const handleZoom = useCallback((direction: "in" | "out", factor = 1.2) => {
    const nextScale = clamp(direction === "in" ? viewState.scale * factor : viewState.scale / factor, 1, 6);
    const clamped = clampTranslation(viewState.x, viewState.y, nextScale);
    syncViewState({ scale: nextScale, ...clamped });
  }, [clampTranslation, syncViewState, viewState.scale, viewState.x, viewState.y]);

  const resetView = useCallback(() => {
    syncViewState({ x: 0, y: 0, scale: 1 });
  }, [syncViewState]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current || !mapContentRef.current) return;

    const contentRect = mapContentRef.current.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;
    const paddedLeft = contentRect.left + renderedImageBox.offsetX * viewState.scale;
    const paddedTop = contentRect.top + renderedImageBox.offsetY * viewState.scale;
    const drawnWidth = renderedImageBox.width * viewState.scale;
    const drawnHeight = renderedImageBox.height * viewState.scale;

    if (
      clickX < paddedLeft ||
      clickX > paddedLeft + drawnWidth ||
      clickY < paddedTop ||
      clickY > paddedTop + drawnHeight
    ) {
      return;
    }

    const relativeX = (clickX - paddedLeft) / drawnWidth;
    const relativeY = (clickY - paddedTop) / drawnHeight;
    const lon = relativeX * (bounds.right - bounds.left) + bounds.left;
    const lat = bounds.top - relativeY * (bounds.top - bounds.bottom);

    onMapClick([lat, lon]);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div
        ref={mapContainerRef}
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/70 shadow-[0_30px_80px_rgba(0,0,0,0.38)] cursor-grab active:cursor-grabbing",
          className,
        )}
        style={{ touchAction: "none" }}
      >
        <Image
          src={imageUrl || DEFAULT_VIBE_MAP_IMAGE}
          alt="Vibe City Map backdrop"
          fill
          className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125"
          unoptimized
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />

        <motion.div
          ref={mapContentRef}
          className="relative h-full w-full"
          style={{ x, y, scale: viewState.scale }}
          onWheel={(e) => {
            e.preventDefault();
            handleZoom(e.deltaY < 0 ? "in" : "out", 1.18);
          }}
        >
          <div className="absolute inset-0" onClick={isEditable ? handleMapClick : undefined}>
            <div
              className="absolute rounded-[24px] border border-white/12 shadow-[0_20px_70px_rgba(15,23,42,0.45)] overflow-hidden"
              style={{
                left: renderedImageBox.offsetX,
                top: renderedImageBox.offsetY,
                width: renderedImageBox.width,
                height: renderedImageBox.height,
              }}
            >
              <Image
                src={imageUrl || DEFAULT_VIBE_MAP_IMAGE}
                alt="Vibe City Map"
                fill
                className="pointer-events-none object-contain"
                unoptimized
                onLoadingComplete={(img) => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })}
              />
            </div>

            <svg
              className="absolute left-0 top-0 h-full w-full pointer-events-none overflow-visible"
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {points.map((point) => {
                if (point.type === "point" || !point.coords || point.coords.length < 2) return null;

                const pathPoints = point.coords
                  .map((c) => project(c[0], c[1], bounds))
                  .filter((p): p is { x: number; y: number } => p !== null);

                if (pathPoints.length < 2) return null;

                const pathD = pathPoints
                  .map((p, i) => {
                    const px = (p.x / 100) * imageSize.width;
                    const py = (p.y / 100) * imageSize.height;
                    return `${i === 0 ? "M" : "L"} ${px} ${py}`;
                  })
                  .join(" ");

                return (
                  <motion.path
                    key={point.id}
                    d={pathD + (point.type === "loop" ? " Z" : "")}
                    stroke={point.color || "#FF69B4"}
                    strokeWidth={3}
                    fill="none"
                    strokeDasharray={isEditable ? "5 5" : "none"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0 0 10px rgba(15,23,42,0.45))" }}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.9 }}
                    transition={{ duration: 1 }}
                  />
                );
              })}
            </svg>

            {points.map((point) => {
              const isSinglePoint = point.type === "point" || point.coords.length === 1;
              if (!isSinglePoint || !point.coords || point.coords.length === 0) return null;

              const projected = project(point.coords[0][0], point.coords[0][1], bounds);
              if (!projected) return null;

              const isHighlighted = highlightedPointId === point.id;
              const isImage = point.icon.startsWith("image:");
              const iconUrl = isImage ? point.icon.replace("image:", "") : "";

              return (
                <Tooltip key={point.id}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{
                        left: `${projected.x}%`,
                        top: `${projected.y}%`,
                        scale: (isHighlighted ? 1.5 : 1) / viewState.scale,
                        zIndex: isHighlighted ? 50 : 10,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      {isImage ? (
                        <Image
                          src={iconUrl}
                          alt={point.name}
                          width={30}
                          height={30}
                          className="rounded-full border-2 border-white/80 bg-black/50 object-cover shadow-lg"
                          unoptimized
                        />
                      ) : (
                        <div className={cn("relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-white/20", point.color)}>
                          <div className="absolute inset-0 rounded-full bg-current opacity-20 blur-[2px]" />
                          <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-15" />
                          <VibeContentRenderer content={point.icon} className="relative z-10 h-5 w-5 text-white drop-shadow-md" />
                        </div>
                      )}
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="border-brand-lime bg-dark-card font-mono text-foreground">
                    <p>{point.name}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </motion.div>

        <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 p-3 sm:p-4">
          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md">
            VibeMap • drag / pinch / zoom
          </div>
          <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md">
            {Math.round(viewState.scale * 100)}%
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
          <Button size="icon" onClick={() => handleZoom("in", 1.5)} className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple">
            <VibeContentRenderer content="::FaPlus::" />
          </Button>
          <Button size="icon" onClick={() => handleZoom("out", 1.5)} className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple">
            <VibeContentRenderer content="::FaMinus::" />
          </Button>
          <Button size="icon" onClick={resetView} className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple">
            <VibeContentRenderer content="::FaLocationCrosshairs::" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
