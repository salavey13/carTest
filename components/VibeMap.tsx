"use client";

import Image from 'next/image';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';

export interface MapPoint {
  id: string;
  name: string;
  coordinates: [number, number]; // [latitude, longitude]
  icon: string;
  color?: string;
}

export interface MapBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface VibeMapProps {
  points: MapPoint[];
  bounds: MapBounds;
  imageUrl: string;
  highlightedPointId?: string | null;
  className?: string;
  zoom?: number;
  center?: [number, number];
}

const projectCoordinates = (lat: number, lon: number, bounds: MapBounds): { x: number; y: number } | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) {
    return null;
  }
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  return { x, y };
};

export function VibeMap({ points, bounds, imageUrl, highlightedPointId, className, zoom = 1, center }: VibeMapProps) {
  const [scale, setScale] = useState(zoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Center map on initial load if center prop is provided
    if (center && mapContainerRef.current) {
        const projectedCenter = projectCoordinates(center[0], center[1], bounds);
        if (projectedCenter) {
            const containerWidth = mapContainerRef.current.offsetWidth;
            const containerHeight = mapContainerRef.current.offsetHeight;
            
            const targetX = (containerWidth / 2) - (projectedCenter.x / 100 * containerWidth * scale);
            const targetY = (containerHeight / 2) - (projectedCenter.y / 100 * containerHeight * scale);
            
            setOffset({ x: targetX, y: targetY });
        }
    }
  }, [center, zoom, bounds]); // Rerun if these change to recenter


  const handleZoom = (direction: 'in' | 'out') => {
    const zoomFactor = 1.5;
    const newScale = direction === 'in' ? scale * zoomFactor : scale / zoomFactor;
    setScale(Math.max(1, Math.min(newScale, 16))); // Clamp zoom between 1x and 16x
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div ref={mapContainerRef} className={cn("relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20 cursor-grab active:cursor-grabbing", className)}>
        <motion.div
            className="relative w-full h-full"
            style={{ scale, x: offset.x, y: offset.y }}
            drag
            dragConstraints={mapContainerRef}
            onDrag={(_, info) => {
                setOffset({ x: offset.x + info.delta.x, y: offset.y + info.delta.y });
            }}
            onWheel={(e) => {
                e.preventDefault();
                handleZoom(e.deltaY < 0 ? 'in' : 'out');
            }}
        >
          <Image
            src={imageUrl}
            alt="Vibe City Map"
            layout="fill"
            objectFit="contain"
            className="opacity-50 pointer-events-none"
            unoptimized
          />

          {points.map((point) => {
            const projected = projectCoordinates(point.coordinates[0], point.coordinates[1], bounds);
            if (!projected) return null;

            const isHighlighted = highlightedPointId === point.id;

            return (
              <Tooltip key={point.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${projected.x}%`,
                      top: `${projected.y}%`,
                      zIndex: isHighlighted ? 10 : 5,
                      scale: 1 / scale // Counter-scale to keep size constant
                    }}
                    animate={{ scale: (isHighlighted ? 1.5 : 1) / scale }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300", point.color)}>
                       <div className="absolute inset-0 bg-current rounded-full animate-pulse opacity-50"/>
                       <VibeContentRenderer content={point.icon} className="relative z-10 w-4 h-4 text-white drop-shadow-lg"/>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent className="bg-dark-card border-brand-lime text-foreground font-mono">
                  <p>{point.name}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </motion.div>

         <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <Button size="icon" onClick={() => handleZoom('in')} className="w-8 h-8"><VibeContentRenderer content="::FaPlus::" /></Button>
            <Button size="icon" onClick={() => handleZoom('out')} className="w-8 h-8"><VibeContentRenderer content="::FaMinus::" /></Button>
         </div>
      </div>
    </TooltipProvider>
  );
}