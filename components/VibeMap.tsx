"use client";

import Image from "next/image";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { VibeContentRenderer } from "./VibeContentRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "./ui/button";
import { useGesture } from "@use-gesture/react";
import { project, unproject, PointOfInterest, MapBounds, getRenderBox, getDragLimits } from "@/lib/map-utils";

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
type RenderBox = { width: number; height: number; offsetX: number; offsetY: number };

const DEFAULT_VIBE_MAP_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg";
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_FACTOR = 1.18;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function VibeMap({
  points,
  bounds,
  imageUrl,
  highlightedPointId,
  className,
  isEditable = false,
  onMapClick,
}: VibeMapProps) {
  // State
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const [imageSize, setImageSize] = useState<Size>({ width: 1, height: 1 });
  const [containerSize, setContainerSize] = useState<Size>({ width: 1, height: 1 });
  
  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapContentRef = useRef<HTMLDivElement>(null);
  
  // Motion values for smooth transforms
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  
  // Derived values
  const renderBox = useMemo(() => 
    getRenderBox(containerSize, imageSize), 
    [containerSize, imageSize]
  );
  
  // Sync motion values with state for external access
  const syncViewState = useCallback((next: { x: number; y: number; scale: number }) => {
    setViewState(next);
    x.set(next.x);
    y.set(next.y);
    scale.set(next.scale);
  }, [x, y, scale]);
  
  // Clamp translation to prevent panning beyond bounds
  const clampTranslation = useCallback((nextX: number, nextY: number, nextScale: number) => {
    const limits = getDragLimits(containerSize, imageSize, nextScale);
    return {
      x: clamp(nextX, -limits.maxX, limits.maxX),
      y: clamp(nextY, -limits.maxY, limits.maxY),
    };
  }, [containerSize, imageSize]);
  
  // Handle container resize with ResizeObserver
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    
    const updateSize = () => {
      setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    };
    
    updateSize();
    
    // Use ResizeObserver for precise resize detection
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(el);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Gesture handlers
  useGesture(
    {
      onDrag: ({ offset: [dx, dy], active }) => {
        if (!active) return;
        const clamped = clampTranslation(dx, dy, viewState.scale);
        syncViewState({ ...viewState, ...clamped });
      },
      onPinch: ({ offset: [d], origin: [ox, oy], active }) => {
        if (!active || !mapContainerRef.current) return;
        
        const nextScale = clamp(d, MIN_SCALE, MAX_SCALE);
        
        // Zoom toward pinch focal point
        const containerRect = mapContainerRef.current.getBoundingClientRect();
        const focalX = ox - containerRect.left - containerSize.width / 2 - viewState.x;
        const focalY = oy - containerRect.top - containerSize.height / 2 - viewState.y;
        
        const scaleRatio = nextScale / viewState.scale;
        let nextX = viewState.x * scaleRatio - focalX * (scaleRatio - 1);
        let nextY = viewState.y * scaleRatio - focalY * (scaleRatio - 1);
        
        const clamped = clampTranslation(nextX, nextY, nextScale);
        syncViewState({ scale: nextScale, ...clamped });
      },
    },
    {
      target: mapContainerRef,
      eventOptions: { passive: false },
      drag: { 
        from: () => [viewState.x, viewState.y] as const, 
        preventDefault: true,
        filterTaps: true,
      },
      pinch: { 
        from: () => [viewState.scale, 0] as const,
        preventDefault: true,
      },
    },
  );
  
  // Zoom controls with cursor-aware positioning
  const handleZoom = useCallback((direction: "in" | "out", factor = ZOOM_FACTOR, cursorPos?: { x: number; y: number }) => {
    const nextScale = clamp(
      direction === "in" ? viewState.scale * factor : viewState.scale / factor, 
      MIN_SCALE, 
      MAX_SCALE
    );
    
    if (cursorPos && mapContainerRef.current) {
      // Zoom toward cursor position
      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const focalX = cursorPos.x - containerRect.left - containerSize.width / 2 - viewState.x;
      const focalY = cursorPos.y - containerRect.top - containerSize.height / 2 - viewState.y;
      
      const scaleRatio = nextScale / viewState.scale;
      let nextX = viewState.x * scaleRatio - focalX * (scaleRatio - 1);
      let nextY = viewState.y * scaleRatio - focalY * (scaleRatio - 1);
      
      const clamped = clampTranslation(nextX, nextY, nextScale);
      syncViewState({ scale: nextScale, ...clamped });
    } else {
      // Default: zoom from center
      const clamped = clampTranslation(viewState.x, viewState.y, nextScale);
      syncViewState({ scale: nextScale, ...clamped });
    }
  }, [clampTranslation, syncViewState, viewState, containerSize]);
  
  const resetView = useCallback(() => {
    syncViewState({ x: 0, y: 0, scale: 1 });
  }, [syncViewState]);
  
  // Precise click handling with coordinate transformation
  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current || !mapContentRef.current) return;
    
    const containerRect = mapContainerRef.current.getBoundingClientRect();
    const contentRect = mapContentRef.current.getBoundingClientRect();
    
    // Calculate click position relative to scaled/translated content
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;
    
    // Account for render box offset and current transform
    const imageLeft = renderBox.offsetX * viewState.scale + viewState.x + containerSize.width / 2;
    const imageTop = renderBox.offsetY * viewState.scale + viewState.y + containerSize.height / 2;
    const imageWidth = renderBox.width * viewState.scale;
    const imageHeight = renderBox.height * viewState.scale;
    
    // Check if click is within the rendered image area
    if (
      clickX < imageLeft - imageWidth / 2 ||
      clickX > imageLeft + imageWidth / 2 ||
      clickY < imageTop - imageHeight / 2 ||
      clickY > imageTop + imageHeight / 2
    ) {
      return;
    }
    
    // Convert to percentage within image
    const relativeX = (clickX - (imageLeft - imageWidth / 2)) / imageWidth;
    const relativeY = (clickY - (imageTop - imageHeight / 2)) / imageHeight;
    
    // Convert to lat/lon using inverse projection
    const result = unproject(relativeX * 100, relativeY * 100, bounds);
    if (result) {
      onMapClick(result);
    }
  }, [onMapClick, bounds, viewState, renderBox, containerSize]);
  
  // Wheel zoom with cursor awareness
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cursorPos = { x: e.clientX, y: e.clientY };
    handleZoom(e.deltaY < 0 ? "in" : "out", ZOOM_FACTOR, cursorPos);
  }, [handleZoom]);
  
  // Pre-calculate projected paths for SVG overlay
  const projectedPaths = useMemo(() => {
    return points
      .filter(p => p.type !== "point" && p.coords?.length >= 2)
      .map(point => {
        const pathPoints = point.coords
          .map(c => project(c[0], c[1], bounds))
          .filter((p): p is ProjectedPoint => p !== null);
        
        if (pathPoints.length < 2) return null;
        
        // Convert percentage to SVG coordinates based on image dimensions
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
  
  // Pre-calculate marker positions
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
          "relative h-full w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950/70 shadow-[0_30px_80px_rgba(0,0,0,0.38)] cursor-grab active:cursor-grabbing select-none",
          className,
        )}
        style={{ touchAction: "none" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Ambient background image */}
        <Image
          src={imageUrl || DEFAULT_VIBE_MAP_IMAGE}
          alt="Vibe City Map backdrop"
          fill
          className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125"
          unoptimized
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />
        
        {/* Interactive map layer */}
        <motion.div
          ref={mapContentRef}
          className="relative h-full w-full will-change-transform"
          style={{ x, y, scale }}
          onWheel={handleWheel}
        >
          <div 
            className="absolute inset-0" 
            onClick={isEditable ? handleMapClick : undefined}
            role={isEditable ? "button" : undefined}
            tabIndex={isEditable ? 0 : undefined}
            onKeyDown={isEditable ? (e) => e.key === "Enter" && handleMapClick(e as any) : undefined}
          >
            {/* Main map image container */}
            <div
              className="absolute rounded-[24px] border border-white/12 shadow-[0_20px_70px_rgba(15,23,42,0.45)] overflow-hidden bg-slate-900/30"
              style={{
                left: renderBox.offsetX,
                top: renderBox.offsetY,
                width: renderBox.width,
                height: renderBox.height,
              }}
            >
              <Image
                src={imageUrl || DEFAULT_VIBE_MAP_IMAGE}
                alt="Vibe City Map"
                fill
                className="pointer-events-none object-contain"
                unoptimized
                onLoadingComplete={(img) => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })}
                draggable={false}
              />
            </div>
            
            {/* SVG overlay for paths - aligned with image coordinate system */}
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
            
            {/* Interactive markers */}
            {markerPositions.map((marker) => marker && (
              <Tooltip key={marker.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-lime/50 rounded-full"
                    style={{
                      left: `${marker.x}%`,
                      top: `${marker.y}%`,
                      // Counter-scale markers so they appear consistent size regardless of zoom
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
        
        {/* HUD: Top bar */}
        <div className="absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 p-3 sm:p-4 pointer-events-none">
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-white/75 backdrop-blur-md">
            VibeMap • drag / pinch / scroll
          </div>
          <div className="pointer-events-auto rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md min-w-[60px] text-center">
            {Math.round(viewState.scale * 100)}%
          </div>
        </div>
        
        {/* Controls: Bottom-right */}
        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
          <Button 
            size="icon" 
            onClick={() => handleZoom("in")} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Zoom in"
          >
            <VibeContentRenderer content="::FaPlus::" />
          </Button>
          <Button 
            size="icon" 
            onClick={() => handleZoom("out")} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Zoom out"
          >
            <VibeContentRenderer content="::FaMinus::" />
          </Button>
          <Button 
            size="icon" 
            onClick={resetView} 
            className="h-10 w-10 rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md hover:bg-brand-purple/80 hover:border-brand-purple/30 transition-colors"
            aria-label="Reset view"
          >
            <VibeContentRenderer content="::FaLocationCrosshairs::" />
          </Button>
        </div>
        
        {/* Subtle edge fade for depth */}
        <div className="absolute inset-0 pointer-events-none rounded-[28px] shadow-[inset_0_0_60px_rgba(2,6,23,0.6)]" />
      </div>
    </TooltipProvider>
  );
}