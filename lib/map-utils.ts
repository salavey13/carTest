export interface MapBounds {
  top: number;      // max latitude (north)
  bottom: number;   // min latitude (south)
  left: number;     // min longitude (west)
  right: number;    // max longitude (east)
}

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][]; // [lat, lon] pairs
}

export interface ProjectedPoint {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

/**
 * Projects lat/lon to percentage coordinates on map image.
 * Uses equirectangular projection with bounds validation.
 */
export const project = (
  lat: number,
  lon: number,
  bounds: MapBounds
): ProjectedPoint | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  // Prevent division by zero on degenerate bounds
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  // Clamp to bounds with small epsilon for edge tolerance
  const epsilon = 1e-10;
  if (lat < bounds.bottom - epsilon || lat > bounds.top + epsilon || 
      lon < bounds.left - epsilon || lon > bounds.right + epsilon) {
    return null;
  }
  
  const x = ((lon - bounds.left) / lonSpan) * 100;
  const y = ((bounds.top - lat) / latSpan) * 100; // Invert Y for screen coords
  
  return { 
    x: Math.max(0, Math.min(100, x)), 
    y: Math.max(0, Math.min(100, y)) 
  };
};

/**
 * Inverse projection: converts percentage coords back to lat/lon.
 */
export const unproject = (
  xPercent: number,
  yPercent: number,
  bounds: MapBounds
): [number, number] | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  const lon = bounds.left + (xPercent / 100) * lonSpan;
  const lat = bounds.top - (yPercent / 100) * latSpan;
  
  return [lat, lon];
};

/**
 * Calculates the rendered image box within a container (contain fit).
 */
export const getRenderBox = (container: { width: number; height: number }, image: { width: number; height: number }) => {
  const safeImageWidth = Math.max(1, image.width);
  const safeImageHeight = Math.max(1, image.height);
  const imageRatio = safeImageWidth / safeImageHeight;
  const containerRatio = Math.max(1, container.width) / Math.max(1, container.height);

  if (imageRatio > containerRatio) {
    // Image is wider: fit to width
    const width = container.width;
    const height = width / imageRatio;
    return { width, height, offsetX: 0, offsetY: (container.height - height) / 2 };
  }
  
  // Image is taller: fit to height
  const height = container.height;
  const width = height * imageRatio;
  return { width, height, offsetX: (container.width - width) / 2, offsetY: 0 };
};

/**
 * Calculates drag limits to prevent panning beyond image edges.
 */
export const getDragLimits = (
  container: { width: number; height: number },
  image: { width: number; height: number },
  scale: number
) => {
  const render = getRenderBox(container, image);
  const scaledWidth = render.width * scale;
  const scaledHeight = render.height * scale;

  return {
    maxX: Math.max(0, (scaledWidth - container.width) / 2),
    maxY: Math.max(0, (scaledHeight - container.height) / 2),
  };
};