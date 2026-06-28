/**
 * lib/image-fallback.ts
 * 
 * Utility for local-first image loading with Supabase fallback.
 * 
 * Strategy:
 *   1. Convert Supabase URL to local mirror path
 *   2. <img src={localPath} onError={() => src = supabaseUrl} />
 *   3. If local exists → instant load (no network)
 *   4. If local missing → fallback to Supabase
 * 
 * Usage in components:
 *   import { localImageSrc, handleImageError } from '@/lib/image-fallback';
 *   
 *   <img 
 *     src={localImageSrc(bike.image_url)} 
 *     onError={handleImageError(bike.image_url)}
 *   />
 * 
 * Or with a wrapper component:
 *   import { SmartImage } from '@/lib/image-fallback';
 *   <SmartImage src={bike.image_url} alt={bike.model} className="..." />
 */

/**
 * Convert a Supabase storage URL to a local mirror path.
 * 
 * https://xxx.supabase.co/storage/v1/object/public/carpix/bike/image_1.jpg
 *   → /supabase-mirror/carpix/bike/image_1.jpg
 * 
 * Non-Supabase URLs are returned as-is.
 */
export function localImageSrc(supabaseUrl: string | null | undefined): string {
  if (!supabaseUrl || typeof supabaseUrl !== 'string') {
    return '/placeholder-bike.svg';
  }

  // Check if it's a Supabase storage URL
  const match = supabaseUrl.match(/\/storage\/v1\/object\/public\/(.+)$/);
  if (match) {
    return `/supabase-mirror/${match[1]}`;
  }

  // Non-Supabase URL (external, data URI, local path) — return as-is
  return supabaseUrl;
}

/**
 * Get the original Supabase URL from any image URL (reverse of localImageSrc).
 * If the input is already a Supabase URL, return it.
 * If it's a local mirror path, reconstruct the Supabase URL.
 */
export function supabaseUrlFromLocal(localPath: string | null | undefined): string {
  if (!localPath || typeof localPath !== 'string') {
    return '';
  }

  // Already a Supabase URL
  if (localPath.includes('supabase.co/storage/v1/object/public/')) {
    return localPath;
  }

  // Local mirror path → reconstruct Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inmctohsodgdohamhzag.supabase.co';
  const match = localPath.match(/^\/supabase-mirror\/(.+)$/);
  if (match) {
    return `${supabaseUrl}/storage/v1/object/public/${match[1]}`;
  }

  return localPath;
}

/**
 * onError handler for <img> tags.
 * Falls back to Supabase URL when local image fails to load.
 * 
 * Usage:
 *   <img src={localImageSrc(url)} onError={handleImageError(url)} />
 */
export function handleImageError(originalUrl: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const fallbackSrc = supabaseUrlFromLocal(originalUrl);
    
    // Prevent infinite loop: only fallback once
    if (img.src !== fallbackSrc && fallbackSrc) {
      img.src = fallbackSrc;
    }
  };
}

/**
 * SmartImage — drop-in replacement for <img> with local-first loading.
 * 
 * <SmartImage src={bike.image_url} alt="Falcon GT" className="rounded-xl" />
 */
import React from 'react';

export function SmartImage({ 
  src, 
  alt = '', 
  className = '',
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const localSrc = localImageSrc(src);
  
  return (
    <img
      src={localSrc}
      alt={alt}
      className={className}
      onError={handleImageError(src)}
      loading="lazy"
      {...props}
    />
  );
}
