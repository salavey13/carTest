"use client";

import Image from 'next/image';
import { motion } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const containerSize = 100 * zoom;
  const offset = (containerSize - 100) / 2;
  
  let centerOffset = { x: 0, y: 0 };
  if(center) {
    const projectedCenter = projectCoordinates(center[0], center[1], bounds);
    if(projectedCenter) {
      centerOffset.x = 50 - projectedCenter.x * zoom;
      centerOffset.y = 50 - projectedCenter.y * zoom;
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20", className)}>
        <motion.div
            className="relative"
            style={{ 
              width: `${containerSize}%`, 
              height: `${containerSize}%`,
              top: `-${offset - centerOffset.y}%`,
              left: `-${offset - centerOffset.x}%`
            }}
        >
          <Image
            src={imageUrl}
            alt="Vibe City Map"
            layout="fill"
            objectFit="contain"
            className="opacity-50"
            unoptimized // Good for external URLs that might change
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
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: isHighlighted ? 1.5 : 1, opacity: 1 }}
                    transition={{ type: 'spring' }}
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
      </div>
    </TooltipProvider>
  );
}