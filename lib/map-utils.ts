export interface MapBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][];
}

/**
 * Projects a lat/lon coordinate to a percentage {x, y} on the map image.
 * Assumes a linear interpolation (Equirectangular-like projection) which is 
 * standard for static image calibration.
 */
export const project = (
  lat: number, 
  lon: number, 
  bounds: MapBounds
): { x: number; y: number } | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) {
    return null;
  }
  
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  // Y is inverted (Top is 100%, Bottom is 0% in screen coords, but Top is max Lat)
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  
  return { x, y };
};