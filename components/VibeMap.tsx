"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { VibeContentRenderer } from "./VibeContentRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { useGesture } from "@use-gesture/react";
import { 
  project, unproject, PointOfInterest, GeoBounds, ViewState,
  getRenderBox, getDragLimits, clamp, percentToPixel,
  DEFAULT_MAP_IMAGE, FALLBACK_MAP_IMAGE,
  MIN_MAP_SCALE, MAX_MAP_SCALE, MAP_ZOOM_FACTOR,
  MAP_GESTURE_EPSILON, MAP_INERTIA_MULTIPLIER, MAP_SPRING_CONFIG,
  MAP_PERSISTENCE_DEBOUNCE_MS, generateStorageKey
} from "@/lib/map-utils";
import { toast } from "sonner";

interface VibeMapProps {
  points: PointOfInterest[];
  bounds: GeoBounds;
  imageUrl?: string;
  highlightedPointId?: string | null;
  className?: string;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
  onViewChange?: (view: ViewState) => void;
}

export function VibeMap({
  points, bounds, imageUrl, highlightedPointId, className,
  isEditable = false, onMapClick, onViewChange,
}: VibeMapProps) {
  const [viewState, setViewState] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [containerSize, setContainerSize] = useState({ width: 1, height: 1 });
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl || DEFAULT_MAP_IMAGE);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scaleMotion = useMotionValue(1);
  const springScale = useSpring(1, MAP_SPRING_CONFIG);

  const renderBox = useMemo(() => getRenderBox(containerSize, imageSize), [containerSize, imageSize]);
  const storageKey = useMemo(() => generateStorageKey(bounds), [bounds]);

  const syncViewState = useCallback((next: ViewState) => {
    setViewState(next);
    x.set(next.x);
    y.set(next.y);
    scaleMotion.set(next.scale);
    springScale.set(next.scale);
    onViewChange?.(next);
  }, [x, y, scaleMotion, springScale, onViewChange]);

  const clampTranslation = useCallback((nextX: number, nextY: number, nextScale: number) => {
    const limits = getDragLimits(containerSize, imageSize, nextScale);
    return {
      x: clamp(nextX, -limits.maxX, limits.maxX),
      y: clamp(nextY, -limits.maxY, limits.maxY),
    };
  }, [containerSize, imageSize]);

  // ResizeObserver
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Persist/restore view state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ViewState;
        syncViewState({
          x: clamp(parsed.x ?? 0, -5000, 5000),
          y: clamp(parsed.y ?? 0, -5000, 5000),
          scale: clamp(parsed.scale ?? 1, MIN_MAP_SCALE, MAX_MAP_SCALE),
        });
      }
    } catch (e) {
      console.warn('[VibeMap] Failed to restore view state:', e);
    }
  }, [storageKey, syncViewState]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(viewState));
      } catch (e) {
        console.warn('[VibeMap] Failed to persist view state:', e);
      }
    }, MAP_PERSISTENCE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [viewState, storageKey]);

  // Update image URL if prop changes
  useEffect(() => {
    if (imageUrl) setCurrentImageUrl(imageUrl);
  }, [imageUrl]);

  // Gesture handlers with inertial momentum
  useGesture({
    onDrag: ({ offset: [dx, dy], active, velocity: [vx, vy] }) => {
      if (active) {
        const clamped = clampTranslation(dx, dy, viewState.scale);
        syncViewState({ ...viewState, ...clamped });
      } else {
        // Inertial momentum on release
        const momentumX = vx * MAP_INERTIA_MULTIPLIER;
        const momentumY = vy * MAP_INERTIA_MULTIPLIER;
        const finalX = clamp(viewState.x + momentumX, -5000, 5000);
        const finalY = clamp(viewState.y + momentumY, -5000, 5000);
        const clamped = clampTranslation(finalX, finalY, viewState.scale);
        syncViewState({ ...viewState, ...clamped });
      }
    },
    onPinch: ({ offset: [d], origin: [ox, oy], active }) => {
      if (!active || !mapContainerRef.current) return;
      const nextScale = clamp(d, MIN_MAP_SCALE, MAX_MAP_SCALE);
      const containerRect = mapContainerRef.current.getBoundingClientRect();

      const pointerX = ox - containerRect.left;
      const pointerY = oy - containerRect.top;
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;

      const focalX = (pointerX - centerX - viewState.x) / viewState.scale;
      const focalY = (pointerY - centerY - viewState.y) / viewState.scale;

      const scaleRatio = nextScale / viewState.scale;
      const nextX = viewState.x + focalX * (1 - scaleRatio) * viewState.scale;
      const nextY = viewState.y + focalY * (1 - scaleRatio) * viewState.scale;

      const clamped = clampTranslation(nextX, nextY, nextScale);
      syncViewState({ scale: nextScale, ...clamped });
    },
  }, {
    target: mapContainerRef,
    eventOptions: { passive: false },
    drag: { from: () => [viewState.x, viewState.y] as const, preventDefault: true, filterTaps: true },
    pinch: { from: () => [viewState.scale, 0] as const, preventDefault: true },
  });

  const handleZoom = useCallback((direction: "in" | "out", factor = MAP_ZOOM_FACTOR, cursorPos?: { x: number; y: number }) => {
    const nextScale = clamp(
      direction === "in" ? viewState.scale * factor : viewState.scale / factor,
      MIN_MAP_SCALE,
      MAX_MAP_SCALE
    );

    if (cursorPos && mapContainerRef.current) {
      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const pointerX = cursorPos.x - containerRect.left;
      const pointerY = cursorPos.y - containerRect.top;
      const centerX = containerSize.width / 2;
      const centerY = containerSize.height / 2;

      const focalX = (pointerX - centerX - viewState.x) / viewState.scale;
      const focalY = (pointerY - centerY - viewState.y) / viewState.scale;

      const scaleRatio = nextScale / viewState.scale;
      const nextX = viewState.x + focalX * (1 - scaleRatio) * viewState.scale;
      const nextY = viewState.y + focalY * (1 - scaleRatio) * viewState.scale;

      const clamped = clampTranslation(nextX, nextY, nextScale);
      syncViewState({ scale: nextScale, ...clamped });
    } else {
      const clamped = clampTranslation(viewState.x, viewState.y, nextScale);
      syncViewState({ scale: nextScale, ...clamped });
    }
  }, [clampTranslation, syncViewState, viewState, containerSize]);

  const resetView = useCallback(() => {
    syncViewState({ x: 0, y: 0, scale: 1 });
    toast.info("View reset", { duration: 1500 });
  }, [syncViewState]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isEditable) return;
    
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      handleZoom("in");
      toast.success("Zoomed in", { duration: 800 });
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      handleZoom("out");
      toast.success("Zoomed out", { duration: 800 });
    }
    if (e.key === "0") {
      e.preventDefault();
      resetView();
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const step = 30 / viewState.scale;
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, step], ArrowDown: [0, -step],
        ArrowLeft: [step, 0], ArrowRight: [-step, 0],
      };
      const [dx, dy] = deltas[e.key]!;
      const clamped = clampTranslation(viewState.x + dx, viewState.y + dy, viewState.scale);
      syncViewState({ ...viewState, ...clamped });
    }
  }, [isEditable, handleZoom, resetView, clampTranslation, syncViewState, viewState]);

  // Double-click zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;
    e.preventDefault();
    handleZoom("in", 1.6, { x: e.clientX, y: e.clientY });
    toast.success("Zoomed to location", { duration: 800 });
  }, [isEditable, handleZoom]);

  // Image error handling with fallback
  const handleImageError = useCallback(() => {
    if (currentImageUrl !== FALLBACK_MAP_IMAGE) {
      setCurrentImageUrl(FALLBACK_MAP_IMAGE);
      toast.error("Map image failed to load — using fallback", { duration: 4000 });
    }
  }, [currentImageUrl]);

  // Click handler — transform-aware coordinate conversion
  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContentRef.current) return;
    
    const rect = mapContentRef.current.getBoundingClientRect();
    let localX = (e.clientX - rect.left - viewState.x) / viewState.scale;
    let localY = (e.clientY - rect.top - viewState.y) / viewState.scale;

    if (localX < renderBox.offsetX - MAP_GESTURE_EPSILON || 
        localX > renderBox.offsetX + renderBox.width + MAP_GESTURE_EPSILON ||
        localY < renderBox.offsetY - MAP_GESTURE_EPSILON || 
        localY > renderBox.offsetY + renderBox.height + MAP_GESTURE_EPSILON) {
      return;
    }

    const relX = ((localX - renderBox.offsetX) / renderBox.width) * 100;
    const relY = ((localY - renderBox.offsetY) / renderBox.height) * 100;

    const coords = unproject(relX, relY, bounds);
    if (coords) {
      onMapClick(coords);
      if (isEditable) {
        toast.success(`Selected: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`, { duration: 2000 });
      }
    }
  }, [onMapClick, viewState, renderBox, bounds, isEditable]);

  // Memoized path projections
  const projectedPaths = useMemo(() => {
    return points
      .filter(p => p.type !== "point" && p.coords?.length >= 2)
      .map(point => {
        const pathPoints = point.coords
          .map(c => project(c[0], c[1], bounds))
          .filter((p): p is { x: number; y: number } => p !== null);
        
        if (pathPoints.length < 2) return null;
        
        const d = pathPoints
          .map((p, i) => {
            const px = (p.x / 100) * imageSize.width;
            const py = (p.y / 100) * imageSize.height;
            return `${i === 0 ? "M" : "L"} ${px} ${py}`;
          })
          .join(" ");
        
        return {
          id: point.id,
          d: d + (point.type === "loop" ? " Z" : ""),
          color: point.color || "#FF69B4",
          isEditable,
        };
      })
      .filter(Boolean);
  }, [points, bounds, imageSize.width, imageSize.height, isEditable]);

  // Memoized marker positions with renderBox-aware coordinates
  const markerPositions = useMemo(() => {
    return points
      .filter(p => (p.type === "point" || p.coords?.length === 1) && p.coords?.[0])
      .map(point => {
        const projected = project(point.coords[0][0], point.coords[0][1], bounds);
        if (!projected) return null;
        
        const isHighlighted = highlightedPointId === point.id;
        const isImage = point.icon.startsWith("image:");
        
        return {
          id: point.id,
          name: point.name,
          icon: point.icon,
          color: point.color,
          isImage,
          iconUrl: isImage ? point.icon.replace("image:", "") : "",
          x: projected.x,
          y: projected.y,
          isHighlighted,
        };
      })
      .filter(Boolean);
  }, [points, bounds, highlightedPointId]);

  return (
    <TooltipProvider delayDuration={100}>
      <div
        ref={mapContainerRef}
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/70 shadow-[0_30px_80px_rgba(0,0,0,0.38)] cursor-grab active:cursor-grabbing select-none focus:outline-none focus:ring-2 focus:ring-brand-lime/50",
          className,
        )}
        style={{ touchAction: "none" }}
        tabIndex={isEditable ? 0 : -1}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Ambient background */}
        <Image
          src={currentImageUrl}
          alt="Vibe City Map backdrop"
          fill
          className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125 transition-opacity duration-300"
          unoptimized
          aria-hidden
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />
        
        {/* Interactive layer */}
        <motion.div
          ref={mapContentRef}
          className="relative h-full w-full will-change-transform"
          style={{ x, y, scale: springScale }}
          onWheel={(e) => {
            e.preventDefault();
            handleZoom(e.deltaY < 0 ? "in" : "out", MAP_ZOOM_FACTOR, { x: e.clientX, y: e.clientY });
          }}
        >
          <div 
            className="absolute inset-0" 
            onClick={isEditable ? handleMapClick : undefined}
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : undefined}
          >
            {/* Main map image */}
            <div
              className="absolute rounded-[24px] border border-white/12 shadow-[0_20px_70px_rgba(15,23,42,0.45)] overflow-hidden bg-slate-900/30 transition-all duration-200"
              style={{
                left: renderBox.offsetX,
                top: renderBox.offsetY,
                width: renderBox.width,
                height: renderBox.height,
              }}
            >
              <Image
                src={currentImageUrl}
                alt="Vibe City Map"
                fill
                className="pointer-events-none object-contain"
                unoptimized
                onLoadingComplete={(img) => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })}
                onError={handleImageError}
                draggable={false}
              />
            </div>
            
            {/* SVG overlay for paths */}
            <svg
              className="absolute left-0 top-0 h-full w-full pointer-events-none overflow-visible"
              style={{
                left: renderBox.offsetX,
                top: renderBox.offsetY,
                width: renderBox.width,
                height: renderBox.height,
              }}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {projectedPaths.map((path) => (
                path && (
                  <motion.path
                    key={path.id}
                    d={path.d}
                    stroke={path.color}
                    strokeWidth={3}
                    fill="none"
                    strokeDasharray={path.isEditable ? "5 5" : "none"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0 0 10px rgba(15,23,42,0.45))" }}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.9 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                )
              ))}
            </svg>
            
            {/* Markers — pixel-perfect with renderBox offsets */}
            {markerPositions.map((marker) => marker && (
              <Tooltip key={marker.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-lime/50 rounded-full"
                    style={{
                      left: percentToPixel(marker.x, renderBox.offsetX, renderBox.width),
                      top: percentToPixel(marker.y, renderBox.offsetY, renderBox.height),
                      scale: (marker.isHighlighted ? 1.5 : 1) / viewState.scale,
                      zIndex: marker.isHighlighted ? 50 : 10,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25, mass: 0.8 }}
                    whileHover={{ scale: 1.2 / viewState.scale }}
                    whileTap={{ scale: 0.9 / viewState.scale }}
                  >
                    {marker.isImage ? (
                      <Image
                        src={marker.iconUrl}
                        alt={marker.name}
                        width={32}
                        height={32}
                        className="rounded-full border-2 border-white/90 bg-black/50 object-cover shadow-lg transition-shadow hover:shadow-xl"
                        unoptimized
                        draggable={false}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_MAP_IMAGE;
                        }}
                      />
                    ) : (
                      <div 
                        className={cn(
                          "relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-white/25 shadow-lg transition-shadow",
                          marker.color,
                          "hover:shadow-xl hover:ring-white/40"
                        )}
                      >
                        <div className="absolute inset-0 rounded-full bg-current opacity-20 blur-[3px]" />
                        <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-15" />
                        <VibeContentRenderer 
                          content={marker.icon} 
                          className="relative z-10 h-5 w-5 text-white drop-shadow-md" 
                        />
                      </div>
                    )}
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent 
                  side="top" 
                  className="border-brand-lime/30 bg-dark-card/95 font-mono text-foreground backdrop-blur-sm"
                  sideOffset={8}
                >
                  <p className="text-sm">{marker.name}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </motion.div>
        
        {/* HUD */}
        <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 p-3 sm:p-4 pointer-events-none">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md">
            VibeMap • drag / pinch / scroll{isEditable ? " • +/−/0/arrows" : ""}
          </div>
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md min-w-[60px] text-center">
            {Math.round(viewState.scale * 100)}%
          </div>
        </div>
        
        {/* Controls */}
        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
          <Button 
            size="icon" 
            onClick={() => handleZoom("in")} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Zoom in (+)"
          >
            <VibeContentRenderer content="::FaPlus::" />
          </Button>
          <Button 
            size="icon" 
            onClick={() => handleZoom("out")} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Zoom out (−)"
          >
            <VibeContentRenderer content="::FaMinus::" />
          </Button>
          <Button 
            size="icon" 
            onClick={resetView} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Reset view (0)"
          >
            <VibeContentRenderer content="::FaLocationCrosshairs::" />
          </Button>
        </div>
        
        {/* Attribution */}
        <div className="absolute bottom-2 left-2 z-40 text-[10px] text-white/60 bg-black/30 px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
          © Map Data
        </div>
        
        {/* Edge fade */}
        <div className="absolute inset-0 pointer-events-none rounded-[28px] shadow-[inset_0_0_60px_rgba(2,6,23,0.6)]" />
        
        {/* Dev debug panel */}
        {process.env.NODE_ENV === 'development' && (
          <details className="absolute top-20 right-4 z-50 bg-black/80 text-[10px] text-zinc-300 p-2 rounded-lg border border-white/10 max-w-xs">
            <summary className="cursor-pointer font-mono hover:text-white">🔍 Debug</summary>
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
              {JSON.stringify({ scale: viewState.scale.toFixed(2), x: viewState.x.toFixed(0), y: viewState.y.toFixed(0) }, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </TooltipProvider>
  );
}