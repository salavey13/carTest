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
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  
  // Motion values for smoother drag interaction
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Helper to clamp values so we don't drag the map off-screen
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  useGesture({
    onDrag: ({ offset: [dx, dy] }) => {
      if (!mapContainerRef.current) return;
      
      const containerW = mapContainerRef.current.offsetWidth;
      const containerH = mapContainerRef.current.offsetHeight;
      
      // Calculate boundaries based on current scale
      // If scale > 1, we can move the image around.
      // The limit is how much "extra" space we have (imageSize * scale - containerSize)
      const maxOffsetX = Math.max(0, (containerW * viewState.scale) - containerW) / 2;
      const maxOffsetY = Math.max(0, (containerH * viewState.scale) - containerH) / 2;
      
      // Allow some freedom to pan, but stop at edges
      const clampedX = clamp(dx, -maxOffsetX, maxOffsetX);
      const clampedY = clamp(dy, -maxOffsetY, maxOffsetY);

      setViewState(prev => ({ ...prev, x: clampedX, y: clampedY }));
      x.set(clampedX);
      y.set(clampedY);
    },
    onPinch: ({ offset: [s], origin: [ox, oy] }) => {
      // Basic pinch support (could be expanded for pinch-to-zoom at point)
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
   * Zoom towards the mouse cursor position for better UX
   */
  const handleZoom = useCallback((direction: 'in' | 'out', factor = 1.2, event?: React.WheelEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    // Determine mouse position relative to container center
    // If no event provided (button click), zoom to center
    const mx = event ? event.clientX - rect.left : rect.width / 2;
    const my = event ? event.clientY - rect.top : rect.height / 2;

    const nextScale = clamp(
      direction === 'in' ? viewState.scale * factor : viewState.scale / factor,
      0.5,
      6
    );

    // Math to adjust x/y so the point under the mouse stays stationary
    // Formula: offset = mouse - (mouse - currentOffset) * (newScale / currentScale)
    const newOffsetX = mx - (mx - viewState.x) * (nextScale / viewState.scale);
    const newOffsetY = my - (my - viewState.y) * (nextScale / viewState.scale);

    setViewState({ x: newOffsetX, y: newOffsetY, scale: nextScale });
    x.set(newOffsetX);
    y.set(newOffsetY);
  }, [viewState, x, y]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current || !imageSize) return;

    const containerRect = mapContainerRef.current.getBoundingClientRect();
    
    // 1. Get click position relative to the container
    const clickX = e.clientX - containerRect.left;
    const clickY = e.clientY - containerRect.top;

    // 2. Calculate letterboxing (Image contains within Container)
    const containerRatio = containerRect.width / containerRect.height;
    const imageRatio = imageSize.width / imageSize.height;
    let renderW, renderH, padX = 0, padY = 0;

    if (imageRatio > containerRatio) {
      renderW = containerRect.width;
      renderH = renderW / imageRatio;
      padY = (containerRect.height - renderH) / 2;
    } else {
      renderH = containerRect.height;
      renderW = renderH * imageRatio;
      padX = (containerRect.width - renderW) / 2;
    }

    // 3. Remove Pan and Scale to get coordinate relative to un-transformed container
    // Note: We use transformOrigin: "0 0" on the motion.div, so this math is linear.
    const rawX = (clickX - viewState.x) / viewState.scale;
    const rawY = (clickY - viewState.y) / viewState.scale;

    // 4. Remove Letterboxing to get coordinate relative to the Image itself
    const imgX = rawX - padX;
    const imgY = rawY - padY;

    // 5. Check if click was inside the image (and not the black bars)
    if (imgX < 0 || imgX > renderW || imgY < 0 || imgY > renderH) {
      return; 
    }

    // 6. Convert pixel on image to percentage (0-1)
    const xPct = imgX / renderW;
    const yPct = imgY / renderH;

    // 7. Convert percentage to Lat/Lon
    const lon = xPct * (bounds.right - bounds.left) + bounds.left;
    const lat = bounds.top - (yPct * (bounds.top - bounds.bottom));

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
          className="relative w-full h-full origin-top-left" // CRITICAL: Ensures math matches visuals
          style={{ x, y, scale: viewState.scale }}
          onWheel={(e) => { 
            e.preventDefault(); 
            handleZoom(e.deltaY < 0 ? 'in' : 'out', 1.2, e); 
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

                // Convert percentage coordinates to SVG pixel coordinates
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
                    strokeWidth={2} // Constant stroke width in SVG pixels
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
                        // Counter-scale to keep icon constant size on screen regardless of map zoom
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