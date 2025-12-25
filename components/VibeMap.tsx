"use client";

import Image from 'next/image';
import { motion, useMotionValue } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { useGesture } from '@use-gesture/react';
import { logger } from '@/lib/debugLogger';
import { project, PointOfInterest, MapBounds } from '@/lib/map-utils';

interface VibeMapProps {
  points: PointOfInterest[];
  bounds: MapBounds;
  imageUrl: string;
  highlightedPointId?: string | null;
  className?: string;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
}

export function VibeMap({ 
  points, 
  bounds, 
  imageUrl, 
  highlightedPointId, 
  className, 
  isEditable = false, 
  onMapClick 
}: VibeMapProps) {
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // We need a ref to the inner moving content to calculate accurate clicks
  const mapContentRef = useRef<HTMLDivElement>(null); 
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Simple clamp helper
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  useGesture({
    onDrag: ({ offset: [dx, dy] }) => {
      if (!mapContainerRef.current) return;
      
      const containerW = mapContainerRef.current.offsetWidth;
      const containerH = mapContainerRef.current.offsetHeight;
      
      // Boundary logic (Clamping)
      // Prevents dragging the map entirely off-screen
      const maxOffsetX = Math.max(0, (containerW * viewState.scale) - containerW) / 2;
      const maxOffsetY = Math.max(0, (containerH * viewState.scale) - containerH) / 2;
      
      // Allow free drag if scaled down, clamp if scaled up
      const clampedX = viewState.scale > 1 ? clamp(dx, -maxOffsetX, maxOffsetX) : dx;
      const clampedY = viewState.scale > 1 ? clamp(dy, -maxOffsetY, maxOffsetY) : dy;

      setViewState(prev => ({ ...prev, x: clampedX, y: clampedY }));
      x.set(clampedX);
      y.set(clampedY);
    },
    onPinch: ({ offset: [s] }) => {
      const newScale = Math.max(0.5, Math.min(s, 6));
      setViewState(prev => ({ ...prev, scale: newScale }));
    },
  }, { 
    target: mapContainerRef, 
    eventOptions: { passive: false },
    drag: { from: () => [viewState.x, viewState.y], preventDefault: true },
    pinch: { from: () => [viewState.scale, 0] }
  });

  /**
   * Safe Zoom - Centers the zoom action
   * Reverting to center-based zoom logic for better mobile stability
   */
  const handleZoom = useCallback((direction: 'in' | 'out', factor = 1.2) => {
    const nextScale = clamp(
      direction === 'in' ? viewState.scale * factor : viewState.scale / factor,
      0.5,
      6
    );
    
    setViewState(prev => ({ ...prev, scale: nextScale }));
  }, [viewState.scale]);

  /**
   * Robust Click Handler using getBoundingClientRect
   * This avoids complex matrix math by asking the browser exactly where the element is.
   */
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current || !mapContentRef.current) return;

    // 1. Get the visual position of the map content relative to the viewport
    const contentRect = mapContentRef.current.getBoundingClientRect();
    const containerRect = mapContainerRef.current.getBoundingClientRect();

    // 2. Get click coordinates
    const clickX = e.clientX;
    const clickY = e.clientY;

    // 3. Check if the click was actually inside the rendered map content
    // This naturally handles letterboxing and transparency
    if (
      clickX < contentRect.left || 
      clickX > contentRect.right || 
      clickY < contentRect.top || 
      clickY > contentRect.bottom
    ) {
      return; // Clicked in the empty void (letterboxing area)
    }

    // 4. Calculate relative position (0.0 to 1.0) based on the ACTUAL drawn size
    const relativeX = (clickX - contentRect.left) / contentRect.width;
    const relativeY = (clickY - contentRect.top) / contentRect.height;

    // 5. Convert percentage to Lat/Lon
    const lon = relativeX * (bounds.right - bounds.left) + bounds.left;
    const lat = bounds.top - (relativeY * (bounds.top - bounds.bottom));

    onMapClick([lat, lon]);
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div 
        ref={mapContainerRef} 
        className={cn(
          "relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20 cursor-grab active:cursor-grabbing", 
          className
        )}
        style={{ touchAction: 'none' }}
      >
        <motion.div
          ref={mapContentRef}
          className="relative w-full h-full"
          style={{ x, y, scale: viewState.scale }}
          onWheel={(e) => { 
            e.preventDefault(); 
            handleZoom(e.deltaY < 0 ? 'in' : 'out', 1.2); 
          }}
        >
          <div className="absolute inset-0" onClick={isEditable ? handleMapClick : undefined}>
            <Image
              src={imageUrl}
              alt="Vibe City Map"
              fill
              className="pointer-events-none"
              unoptimized
              onLoadingComplete={(img) => setImageSize({ width: img.naturalWidth, height: img.naturalHeight })}
            />
            
            {/* SVG Overlay */}
            <svg 
              className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible" 
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} 
              preserveAspectRatio="xMidYMid meet"
            >
              {points.map(point => {
                if (point.type === 'point' || !point.coords || point.coords.length < 2) return null;
                
                const pathPoints = point.coords
                  .map(c => project(c[0], c[1], bounds))
                  .filter((p): p is {x: number, y: number} => p !== null);

                if (pathPoints.length < 2) return null;

                const pathD = pathPoints.map((p, i) => {
                  const px = (p.x / 100) * imageSize.width;
                  const py = (p.y / 100) * imageSize.height;
                  return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
                }).join(' ');

                return (
                  <motion.path
                    key={point.id}
                    d={pathD + (point.type === 'loop' ? ' Z' : '')}
                    stroke={point.color || '#FF69B4'}
                    strokeWidth={2} 
                    fill="none"
                    strokeDasharray={isEditable ? "4 4" : 'none'}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.8 }}
                    transition={{ duration: 1 }}
                  />
                );
              })}
            </svg>

            {/* Points */}
            {points.map((point) => {
              const isSinglePoint = point.type === 'point' || point.coords.length === 1;
              if (!isSinglePoint || !point.coords || point.coords.length === 0) return null;

              const projected = project(point.coords[0][0], point.coords[0][1], bounds);
              if (!projected) return null;

              const isHighlighted = highlightedPointId === point.id;
              const isImage = point.icon.startsWith('image:');
              const iconUrl = isImage ? point.icon.replace('image:', '') : '';

              return (
                <Tooltip key={point.id}>
                  <TooltipTrigger asChild>
                    <motion.div
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ 
                        left: `${projected.x}%`, 
                        top: `${projected.y}%`, 
                        // Keep icon visual size constant relative to the screen, not the map
                        scale: (isHighlighted ? 1.5 : 1) / viewState.scale,
                        zIndex: isHighlighted ? 50 : 10 
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      {isImage ? (
                        <Image
                          src={iconUrl}
                          alt={point.name}
                          width={28}
                          height={28}
                          className="rounded-full border-2 border-white/80 object-cover shadow-lg bg-black/50"
                          unoptimized
                        />
                      ) : (
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", point.color)}>
                           <div className="absolute inset-0 bg-current rounded-full animate-ping opacity-20"/>
                           <VibeContentRenderer content={point.icon} className="relative z-10 w-5 h-5 text-white drop-shadow-md"/>
                        </div>
                      )}
                    </motion.div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-dark-card border-brand-lime text-foreground font-mono">
                    <p>{point.name}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </motion.div>

        {/* Controls */}
        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
          <Button 
            size="icon" 
            onClick={() => handleZoom('in', 1.5)} 
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-brand-purple text-white border border-white/10 backdrop-blur-md"
          >
            <VibeContentRenderer content="::FaPlus::" />
          </Button>
          <Button 
            size="icon" 
            onClick={() => handleZoom('out', 1.5)} 
            className="w-10 h-10 rounded-full bg-black/60 hover:bg-brand-purple text-white border border-white/10 backdrop-blur-md"
          >
            <VibeContentRenderer content="::FaMinus::" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}