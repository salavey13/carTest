/**
 * VibeMap Ecosystem — Shared Utilities
 * Single source of truth for projection math, bounds validation, and coordinate transforms
 * 
 * 🎯 Precision-first design: all math uses double-precision floats with epsilon tolerance
 * 🔄 DRY principle: no duplicate projection logic across components
 * 🛡️ Type-safe: GeoBounds everywhere, validation at boundaries
 */

// === CONFIGURATION CONSTANTS (centralized for consistency) ===
export const DEFAULT_MAP_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg";
export const MIN_MAP_SCALE = 1;
export const MAX_MAP_SCALE = 6;
export const MAP_ZOOM_FACTOR = 1.18;
export const MAP_GESTURE_EPSILON = 1e-10;

// === TYPE DEFINITIONS ===
export type GeoBounds = {
  top: number;    // max latitude (north)
  bottom: number; // min latitude (south)  
  left: number;   // min longitude (west)
  right: number;  // max longitude (east)
};

export type Size = { width: number; height: number };
export type RenderBox = { width: number; height: number; offsetX: number; offsetY: number };
export type ProjectedPoint = { x: number; y: number }; // percentages 0-100

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][]; // [lat, lon] pairs
}

// === CORE PROJECTION MATH ===

/**
 * Projects lat/lon to percentage coordinates on map image.
 * Uses equirectangular projection with bounds validation.
 * 
 * @returns {ProjectedPoint | null} - {x, y} as percentages (0-100) or null if out of bounds
 */
export const project = (
  lat: number,
  lon: number,
  bounds: GeoBounds
): ProjectedPoint | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  // Epsilon tolerance for edge cases
  if (lat < bounds.bottom - MAP_GESTURE_EPSILON || lat > bounds.top + MAP_GESTURE_EPSILON || 
      lon < bounds.left - MAP_GESTURE_EPSILON || lon > bounds.right + MAP_GESTURE_EPSILON) {
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
 * Used for click → coordinate conversion.
 */
export const unproject = (
  xPercent: number,
  yPercent: number,
  bounds: GeoBounds
): [number, number] | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  const lon = bounds.left + (xPercent / 100) * lonSpan;
  const lat = bounds.top - (yPercent / 100) * latSpan;
  
  return [lat, lon];
};

// === RENDERING & LAYOUT UTILITIES ===

/**
 * Calculates the rendered image box within a container (contain fit).
 * Returns dimensions + offsets for centering the image.
 */
export const getRenderBox = (container: Size, image: Size): RenderBox => {
  const safeImageWidth = Math.max(1, image.width);
  const safeImageHeight = Math.max(1, image.height);
  const imageRatio = safeImageWidth / safeImageHeight;
  const containerRatio = Math.max(1, container.width) / Math.max(1, container.height);

  if (imageRatio > containerRatio) {
    // Image is wider: fit to width, center vertically
    const width = container.width;
    const height = width / imageRatio;
    return { width, height, offsetX: 0, offsetY: (container.height - height) / 2 };
  }
  
  // Image is taller: fit to height, center horizontally
  const height = container.height;
  const width = height * imageRatio;
  return { width, height, offsetX: (container.width - width) / 2, offsetY: 0 };
};

/**
 * Calculates drag limits to prevent panning beyond image edges.
 * Ensures the scaled image never shows empty space.
 */
export const getDragLimits = (
  container: Size,
  image: Size,
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

// === CALIBRATION HELPERS ===

/**
 * Calculates map bounds from two known lat/lon points and their pixel positions.
 * Used by the calibrator to derive bounds from user-placed reference points.
 * 
 * @param pointA - First reference point with known lat/lon and pixel position
 * @param pointB - Second reference point with known lat/lon and pixel position
 * @param imageWidth - Natural width of the map image in pixels
 * @param imageHeight - Natural height of the map image in pixels
 */
export const calculateBoundsFromPoints = (
  pointA: { lat: number; lon: number; pixelX: number; pixelY: number },
  pointB: { lat: number; lon: number; pixelX: number; pixelY: number },
  imageWidth: number,
  imageHeight: number
): GeoBounds | null => {
  const { lat: latA, lon: lonA, pixelX: xA, pixelY: yA } = pointA;
  const { lat: latB, lon: lonB, pixelX: xB, pixelY: yB } = pointB;
  
  // Prevent division by zero on degenerate point placement
  if (Math.abs(xB - xA) < 0.001 || Math.abs(yB - yA) < 0.001) return null;
  
  // Calculate degrees per pixel
  const lonPerPixel = (lonB - lonA) / (xB - xA);
  const latPerPixel = (latB - latA) / (yB - yA); // Note: Y increases downward on screen
  
  // Calculate bounds using point A as reference
  const left = lonA - xA * lonPerPixel;
  const right = left + imageWidth * lonPerPixel;
  const top = latA - yA * latPerPixel; // Invert because screen Y is inverted
  const bottom = top + imageHeight * latPerPixel;
  
  // Normalize: ensure top > bottom (north > south), left < right (west < east)
  return {
    top: Math.max(top, bottom),
    bottom: Math.min(top, bottom),
    left: Math.min(left, right),
    right: Math.max(left, right),
  };
};

/**
 * Validates that bounds are geographically reasonable.
 * Returns array of error messages (empty if valid).
 */
export const validateBounds = (bounds: GeoBounds): string[] => {
  const errors: string[] = [];
  
  if (bounds.top <= bounds.bottom) errors.push("top must be greater than bottom (latitude)");
  if (bounds.left >= bounds.right) errors.push("left must be less than right (longitude)");
  if (bounds.top > 90 || bounds.bottom < -90) errors.push("latitude out of range [-90, 90]");
  if (bounds.left < -180 || bounds.right > 180) errors.push("longitude out of range [-180, 180]");
  
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  if (latSpan > 20) errors.push("latitude span too large (>20°) — consider splitting map");
  if (lonSpan > 30) errors.push("longitude span too large (>30°) — consider splitting map");
  
  return errors;
};

/**
 * Formats bounds for display/copy-paste with consistent precision.
 */
export const formatBounds = (bounds: GeoBounds, decimals = 6): string => {
  return JSON.stringify({
    top: Number(bounds.top.toFixed(decimals)),
    bottom: Number(bounds.bottom.toFixed(decimals)),
    left: Number(bounds.left.toFixed(decimals)),
    right: Number(bounds.right.toFixed(decimals)),
  }, null, 2);
};

// === UTILITIES ===

/**
 * Clamp utility for bounding values.
 */
export const clamp = (value: number, min: number, max: number): number => 
  Math.min(Math.max(value, min), max);

/**
 * Linear interpolation helper.
 */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Converts pixel position within renderBox to percentage (0-100).
 */
export const pixelToPercent = (pixel: number, offset: number, size: number): number => {
  if (size <= 0) return 50;
  return clamp(((pixel - offset) / size) * 100, 0, 100);
};

/**
 * Converts percentage (0-100) to pixel position within renderBox.
 */
export const percentToPixel = (percent: number, offset: number, size: number): number => {
  return offset + (clamp(percent, 0, 100) / 100) * size;
};