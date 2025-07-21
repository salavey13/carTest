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

interface VibeMapProps {
  points: MapPoint[];
  highlightedPointId?: string | null;
  className?: string;
  zoom?: number;
  center?: [number, number];
}

// Bounding box for Nizhny Novgorod map image
const MAP_BOUNDS = {
  top: 56.38, // North
  bottom: 56.25, // South
  left: 43.85, // West
  right: 44.15, // East
};

const MAP_IMAGE_URL = 'https://i.imgur.com/22n6k1V.png'; // Using a direct link to a static map image

// Function to convert GPS coordinates to pixel coordinates on the map image
const projectCoordinates = (lat: number, lon: number): { x: number; y: number } | null => {
  if (lat > MAP_BOUNDS.top || lat < MAP_BOUNDS.bottom || lon < MAP_BOUNDS.left || lon > MAP_BOUNDS.right) {
    return null; // Point is outside the map bounds
  }

  const x = ((lon - MAP_BOUNDS.left) / (MAP_BOUNDS.right - MAP_BOUNDS.left)) * 100;
  const y = ((MAP_BOUNDS.top - lat) / (MAP_BOUNDS.top - MAP_BOUNDS.bottom)) * 100;

  return { x, y };
};

export function VibeMap({ points, highlightedPointId, className, zoom = 1, center }: VibeMapProps) {
  const containerSize = 100 * zoom;
  const offset = (containerSize - 100) / 2;
  
  let centerOffset = { x: 0, y: 0 };
  if(center) {
    const projectedCenter = projectCoordinates(center[0], center[1]);
    if(projectedCenter) {
      centerOffset.x = 50 - projectedCenter.x;
      centerOffset.y = 50 - projectedCenter.y;
    }
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className={cn("relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20", className)}>
        <motion.div
            className="relative w-full h-full"
            style={{ 
              width: `${containerSize}%`, 
              height: `${containerSize}%`,
              top: `-${offset - centerOffset.y}%`,
              left: `-${offset - centerOffset.x}%`
            }}
            animate={{
              scale: zoom
            }}
            transition={{ type: "spring", stiffness: 100 }}
        >
          <Image
            src={MAP_IMAGE_URL}
            alt="Vibe City Map"
            layout="fill"
            objectFit="contain"
            className="opacity-50"
          />

          {points.map((point) => {
            const projected = projectCoordinates(point.coordinates[0], point.coordinates[1]);
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
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                  >
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300", point.color, isHighlighted ? 'scale-150' : 'scale-100')}>
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