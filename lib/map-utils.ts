/**
 * VibeMap Ecosystem — Shared Utilities v2.1
 * Single source of truth for projection math, bounds validation, and coordinate transforms
 * 
 * 🎯 Precision-first: double-precision floats with epsilon tolerance
 * 🔄 DRY: zero duplicate projection logic across components  
 * 🛡️ Type-safe: GeoBounds everywhere, validation at boundaries
 * ✨ Enhanced: fitBounds helper, coordinate formatters, grid snapping
 */

// === CONFIGURATION CONSTANTS ===
export const DEFAULT_MAP_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nnmap.jpg";
export const FALLBACK_MAP_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/placeholder-map.jpg";
export const MIN_MAP_SCALE = 1;
export const MAX_MAP_SCALE = 6;
export const MAP_ZOOM_FACTOR = 1.18;
export const MAP_GESTURE_EPSILON = 1e-10;
export const MAP_PERSISTENCE_DEBOUNCE_MS = 350;
export const MAP_INERTIA_MULTIPLIER = 12;
export const MAP_SPRING_CONFIG = { stiffness: 280, damping: 28, mass: 0.6 } as const;

// === TYPE DEFINITIONS ===
export type GeoBounds = {
  top: number;    // max latitude (north)
  bottom: number; // min latitude (south)  
  left: number;   // min longitude (west)
  right: number;  // max longitude (east)
};

export type Size = { width: number; height: number };
export type RenderBox = { width: number; height: number; offsetX: number; offsetY: number };
export type ProjectedPoint = { x: number; y: number };
export type ViewState = { x: number; y: number; scale: number };

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][];
}

// === CORE PROJECTION MATH ===

export const project = (lat: number, lon: number, bounds: GeoBounds): ProjectedPoint | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  if (lat < bounds.bottom - MAP_GESTURE_EPSILON || lat > bounds.top + MAP_GESTURE_EPSILON || 
      lon < bounds.left - MAP_GESTURE_EPSILON || lon > bounds.right + MAP_GESTURE_EPSILON) {
    return null;
  }
  
  const x = ((lon - bounds.left) / lonSpan) * 100;
  const y = ((bounds.top - lat) / latSpan) * 100;
  
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
};

export const unproject = (xPercent: number, yPercent: number, bounds: GeoBounds): [number, number] | null => {
  const latSpan = bounds.top - bounds.bottom;
  const lonSpan = bounds.right - bounds.left;
  
  if (latSpan <= 0 || lonSpan <= 0) return null;
  
  const lon = bounds.left + (xPercent / 100) * lonSpan;
  const lat = bounds.top - (yPercent / 100) * latSpan;
  
  return [lat, lon];
};

// === RENDERING & LAYOUT ===

export const getRenderBox = (container: Size, image: Size): RenderBox => {
  const safeImageWidth = Math.max(1, image.width);
  const safeImageHeight = Math.max(1, image.height);
  const imageRatio = safeImageWidth / safeImageHeight;
  const containerRatio = Math.max(1, container.width) / Math.max(1, container.height);

  if (imageRatio > containerRatio) {
    const width = container.width;
    const height = width / imageRatio;
    return { width, height, offsetX: 0, offsetY: (container.height - height) / 2 };
  }
  
  const height = container.height;
  const width = height * imageRatio;
  return { width, height, offsetX: (container.width - width) / 2, offsetY: 0 };
};

export const getDragLimits = (container: Size, image: Size, scale: number) => {
  const render = getRenderBox(container, image);
  const scaledWidth = render.width * scale;
  const scaledHeight = render.height * scale;

  return {
    maxX: Math.max(0, (scaledWidth - container.width) / 2),
    maxY: Math.max(0, (scaledHeight - container.height) / 2),
  };
};

// === CALIBRATION HELPERS ===

export const calculateBoundsFromPoints = (
  pointA: { lat: number; lon: number; pixelX: number; pixelY: number },
  pointB: { lat: number; lon: number; pixelX: number; pixelY: number },
  imageWidth: number,
  imageHeight: number
): GeoBounds | null => {
  const { lat: latA, lon: lonA, pixelX: xA, pixelY: yA } = pointA;
  const { lat: latB, lon: lonB, pixelX: xB, pixelY: yB } = pointB;
  
  // Prevent division by zero on degenerate point placement
  if (Math.abs(xB - xA) < 0.001 || Math.abs(yB - yA) < 0.001) {
    console.warn('[calculateBoundsFromPoints] Points too close together');
    return null;
  }
  
  // Validate pixel coordinates are within image bounds
  if (xA < 0 || xA > imageWidth || xB < 0 || xB > imageWidth ||
      yA < 0 || yA > imageHeight || yB < 0 || yB > imageHeight) {
    console.warn('[calculateBoundsFromPoints] Points outside image bounds');
    return null;
  }
  
  // Calculate degrees per pixel
  const lonPerPixel = (lonB - lonA) / (xB - xA);
  const latPerPixel = (latB - latA) / (yB - yA);
  
  // Calculate bounds using point A as reference
  const left = lonA - xA * lonPerPixel;
  const right = left + imageWidth * lonPerPixel;
  const top = latA - yA * latPerPixel;
  const bottom = top + imageHeight * latPerPixel;
  
  // Validate results are reasonable
  if (!isFinite(left) || !isFinite(right) || !isFinite(top) || !isFinite(bottom)) {
    console.warn('[calculateBoundsFromPoints] Calculated NaN bounds');
    return null;
  }
  
  // Normalize: ensure top > bottom (north > south), left < right (west < east)
  return {
    top: Math.max(top, bottom),
    bottom: Math.min(top, bottom),
    left: Math.min(left, right),
    right: Math.max(left, right),
  };
};

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

export const formatBounds = (bounds: GeoBounds, decimals = 6): string => {
  return JSON.stringify({
    top: Number(bounds.top.toFixed(decimals)),
    bottom: Number(bounds.bottom.toFixed(decimals)),
    left: Number(bounds.left.toFixed(decimals)),
    right: Number(bounds.right.toFixed(decimals)),
  }, null, 2);
};

// === UTILITIES ===

export const clamp = (value: number, min: number, max: number): number => 
  Math.min(Math.max(value, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const pixelToPercent = (pixel: number, offset: number, size: number): number => {
  if (size <= 0) return 50;
  return clamp(((pixel - offset) / size) * 100, 0, 100);
};

export const percentToPixel = (percent: number, offset: number, size: number): number => {
  return offset + (clamp(percent, 0, 100) / 100) * size;
};

export const formatCoordinate = (value: number, isLatitude: boolean, format: 'dd' | 'dms' = 'dd'): string => {
  if (format === 'dd') return `${value.toFixed(6)}°`;
  
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);
  
  const direction = isLatitude 
    ? (value >= 0 ? 'N' : 'S') 
    : (value >= 0 ? 'E' : 'W');
    
  return `${degrees}°${minutes}'${seconds}"${direction}`;
};

export const snapToGrid = (value: number, grid: number, threshold: number): number => {
  const remainder = value % grid;
  return Math.abs(remainder) < threshold ? Math.round(value / grid) * grid : value;
};

export const fitBounds = (targetBounds: GeoBounds, container: Size, image: Size): ViewState => {
  const renderBox = getRenderBox(container, image);
  const targetWidth = targetBounds.right - targetBounds.left;
  const targetHeight = targetBounds.top - targetBounds.bottom;
  
  const scaleX = renderBox.width / targetWidth;
  const scaleY = renderBox.height / targetHeight;
  const scale = clamp(Math.min(scaleX, scaleY) * 0.9, MIN_MAP_SCALE, MAX_MAP_SCALE);
  
  const centerX = ((targetBounds.left + targetBounds.right) / 2 - (targetBounds.left + targetBounds.right) / 2) / (targetBounds.right - targetBounds.left) * 100;
  const centerY = ((targetBounds.top + targetBounds.bottom) / 2 - targetBounds.bottom) / (targetBounds.top - targetBounds.bottom) * 100;
  
  const targetPixelX = percentToPixel(centerX, renderBox.offsetX, renderBox.width);
  const targetPixelY = percentToPixel(centerY, renderBox.offsetY, renderBox.height);
  
  return {
    x: container.width / 2 - targetPixelX * scale,
    y: container.height / 2 - targetPixelY * scale,
    scale,
  };
};

export const generateStorageKey = (bounds: GeoBounds, prefix = "vibemap"): string => {
  return `${prefix}-${bounds.top.toFixed(3)}-${bounds.bottom.toFixed(3)}-${bounds.left.toFixed(3)}-${bounds.right.toFixed(3)}`;
};