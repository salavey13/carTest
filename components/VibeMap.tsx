"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { useGesture } from '@use-gesture/react';

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][]; // Array of [lat, lon]
}

export interface MapBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface VibeMapProps {
  points: PointOfInterest[];
  bounds: MapBounds;
  imageUrl: string;
  highlightedPointId?: string | null;
  className?: string;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
}

const project = (lat: number, lon: number, bounds: MapBounds): { x: number; y: number } | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) return null;
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  return { x, y };
};

const unproject = (xPercent: number, yPercent: number, bounds: MapBounds, imageSize: {width: number, height: number}, containerSize: {width: number, height: number}): [number, number] => {
    const aspectRatio = imageSize.width / imageSize.height;
    const containerRatio = containerSize.width / containerSize.height;

    let renderWidth, renderHeight, offsetX = 0, offsetY = 0;

    if (aspectRatio > containerRatio) { // Image is wider than container
        renderWidth = containerSize.width;
        renderHeight = renderWidth / aspectRatio;
        offsetY = (containerSize.height - renderHeight) / 2;
    } else { // Image is taller or same ratio
        renderHeight = containerSize.height;
        renderWidth = renderHeight * aspectRatio;
        offsetX = (containerSize.width - renderWidth) / 2;
    }

    const xOnContainer = (xPercent / 100) * containerSize.width;
    const yOnContainer = (yPercent / 100) * containerSize.height;
    
    const xOnImage = xOnContainer - offsetX;
    const yOnImage = yOnContainer - offsetY;

    const xImagePercent = (xOnImage / renderWidth) * 100;
    const yImagePercent = (yOnImage / renderHeight) * 100;
    
    const lon = (xImagePercent / 100) * (bounds.right - bounds.left) + bounds.left;
    const lat = bounds.top - (yImagePercent / 100) * (bounds.top - bounds.bottom);
    
    return [lat, lon];
}


export function VibeMap({ points, bounds, imageUrl, highlightedPointId, className, isEditable = false, onMapClick }: VibeMapProps) {
  const [viewState, setViewState] = useState({ x: 0, y: 0, scale: 1 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({width: 1, height: 1});

  useGesture({
      onDrag: ({ offset: [dx, dy] }) => setViewState(prev => ({ ...prev, x: dx, y: dy })),
      onPinch: ({ offset: [s] }) => setViewState(prev => ({ ...prev, scale: Math.max(0.5, Math.min(s, 16))})),
  }, { 
      target: mapContainerRef, 
      eventOptions: { passive: false },
      drag: { preventDefault: true },
      pinch: { preventDefault: true }
  });
  
  const handleZoom = (direction: 'in' | 'out', factor = 1.5) => {
    setViewState(prev => ({...prev, scale: Math.max(0.5, Math.min(direction === 'in' ? prev.scale * factor : prev.scale / factor, 16))}));
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const mapX = (clickX - viewState.x) / viewState.scale;
    const mapY = (clickY - viewState.y) / viewState.scale;

    const xPercent = (mapX / rect.width) * 100;

    const yPercent = (mapY / rect.height) * 100;
    
    const coords = unproject(xPercent, yPercent, bounds, imageSize, rect);
    onMapClick(coords);
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div 
        ref={mapContainerRef} 
        className={cn("relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20 cursor-grab active:cursor-grabbing", className)}
        style={{ touchAction: 'none' }} // This is the key to prevent page scroll on mobile
      >
        <motion.div
            className="relative w-full h-full"
            style={{ x: viewState.x, y: viewState.y, scale: viewState.scale }}
            onWheel={(e) => { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', 1.2); }}
        >
          <div className="absolute inset-0" onClick={isEditable ? handleMapClick : undefined} >
              <Image
                src={imageUrl}
                alt="Vibe City Map"
                layout="fill"
                objectFit="contain"
                className="pointer-events-none"
                unoptimized
                onLoadingComplete={(img) => setImageSize({width: img.naturalWidth, height: img.naturalHeight})}
              />
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox={`0 0 ${imageSize.width} ${imageSize.height}`} preserveAspectRatio="xMidYMid meet">
                  {points.map(point => {
                      if (point.type === 'point' || !point.coords || point.coords.length < 2) return null;
                      const pathPoints = point.coords.map(c => project(c[0], c[1], bounds)).filter(p => p !== null) as {x: number, y: number}[];
                      if (pathPoints.length < 2) return null;
                      const pathData = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x/100 * imageSize.width} ${p.y/100 * imageSize.height}`).join(' ');
                      
                      return (
                         <motion.path
                            key={point.id}
                            d={pathData + (point.type === 'loop' ? ' Z' : '')}
                            stroke={point.color || '#FF69B4'}
                            strokeWidth={2 / viewState.scale}
                            fill="none"
                            strokeDasharray={isEditable ? `${4 / viewState.scale} ${4 / viewState.scale}` : 'none'}
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 0.7 }}
                            transition={{ duration: 1 }}
                         />
                      )
                  })}
              </svg>

              {points.map((point) => {
                const isSinglePoint = point.type === 'point' || point.coords.length === 1;
                
                // --- CRITICAL FIX: Ensure coords exist and are not empty before proceeding ---
                if (!isSinglePoint || !point.coords || point.coords.length === 0) {
                    return null;
                }

                const positionCoords = point.coords[0];
                const projected = project(positionCoords[0], positionCoords[1], bounds);
                if (!projected) return null;

                const isHighlighted = highlightedPointId === point.id;

                return (
                  <Tooltip key={point.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${projected.x}%`, top: `${projected.y}%`, zIndex: isHighlighted ? 10 : 5 }}
                        animate={{ scale: (isHighlighted ? 1.5 : 1) / viewState.scale }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300", point.color)}>
                           <div className="absolute inset-0 bg-current rounded-full animate-pulse opacity-50"/>
                           <VibeContentRenderer content={point.icon} className="relative z-10 w-4 h-4 text-white drop-shadow-lg"/>

                        </div>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-dark-card border-brand-lime text-foreground font-mono"><p>{point.name}</p></TooltipContent>
                  </Tooltip>
                );
              })}
          </div>
        </motion.div>
         <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <Button size="icon" onClick={() => handleZoom('in')} className="w-8 h-8"><VibeContentRenderer content="::FaPlus::" /></Button>
            <Button size="icon" onClick={() => handleZoom('out')} className="w-8 h-8"><VibeContentRenderer content="::FaMinus::" /></Button>
         </div>
      </div>
    </TooltipProvider>
  );
}