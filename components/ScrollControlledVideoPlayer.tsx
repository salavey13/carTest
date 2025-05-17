"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

interface ScrollControlledVideoPlayerProps {
  src: string;
  className?: string;
  intersectionThreshold?: number | number[];
  scrollPlayFactor?: number; // Kept for API consistency, but current logic doesn't use it directly
}

const ScrollControlledVideoPlayer: React.FC<ScrollControlledVideoPlayerProps> = ({
  src,
  className,
  intersectionThreshold = 0.01,
  // scrollPlayFactor is not actively used in the current refined logic
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isVisible, setIsVisible] = useState(false); // From IntersectionObserver
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isUnderScrollControl, setIsUnderScrollControl] = useState(false); // True if scroll is actively controlling video time

  const lastRAFTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

  // IntersectionObserver callback
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const newVisibility = entry.isIntersecting;
      if (isVisible !== newVisibility) {
        logger.debug(`[ScrollVideo] Video ${src.split('/').pop()} visibility changed to: ${newVisibility}`);
        setIsVisible(newVisibility);
      }
    });
  }, [src, isVisible]);

  // Effect for IntersectionObserver setup
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: intersectionThreshold,
    });
    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
        scrollRAFRef.current = null;
      }
    };
  }, [handleIntersection, intersectionThreshold]);

  // Effect for loading video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const onLoadedMetadata = () => {
        logger.log(`[ScrollVideo] Metadata loaded for ${src.split('/').pop()}: duration ${video.duration}s, readyState ${video.readyState}`);
        setVideoDuration(video.duration);
        if (video.readyState < 1) { // HAVE_NOTHING or HAVE_METADATA but not enough data
            video.load(); // Ensure it tries to load data if not already doing so
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      if (video.readyState >= 1) { // HAVE_METADATA or more
        onLoadedMetadata();
      }
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    }
  }, [src]);

  // Core logic to update video playback based on scroll position
  const updateVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container || videoDuration === null || videoDuration === 0) {
      if (isUnderScrollControl) setIsUnderScrollControl(false);
      return;
    }

    if (!isVisible) { // Should be handled by the main useEffect, but as a safeguard
      if (isUnderScrollControl) setIsUnderScrollControl(false);
      return;
    }
    
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const videoTop = rect.top;
    const videoBottom = rect.bottom;
    const videoHeight = rect.height;

    let newActiveScrollControl = false;
    let newTime = video.currentTime;

    // Condition for scroll control: Video bottom is at/above viewport bottom, AND video top is still below viewport top
    const canBeControlled = videoBottom <= viewportHeight && videoTop > 0;

    if (canBeControlled) {
      newActiveScrollControl = true;
      
      // Playback window: from when videoTop = (viewportHeight - videoHeight) to videoTop = 0
      const controlStartLine = viewportHeight - videoHeight; // videoTop when bottom edge of video meets bottom of viewport
      const controlEndLine = 0; // videoTop when top edge of video meets top of viewport
      
      // Total distance the video's top edge will travel during controlled playback.
      const totalScrollDriveDistance = controlStartLine - controlEndLine;

      if (totalScrollDriveDistance > 0) { // Standard case: video is shorter than viewport
        // How far the video's top has moved from the controlStartLine
        const scrolledDistance = controlStartLine - videoTop;
        let progress = scrolledDistance / totalScrollDriveDistance;
        progress = Math.max(0, Math.min(1, progress));
        newTime = progress * videoDuration;
      } else { 
        // Edge case: video is taller than or as tall as the viewport.
        // Control playback as videoTop moves from viewportHeight down to 0.
        let progress = (viewportHeight - videoTop) / viewportHeight;
        progress = Math.max(0, Math.min(1, progress));
        newTime = progress * videoDuration;
      }
    } else {
      // Not in the conditions for scroll control. Looping will be handled by the main useEffect.
      newActiveScrollControl = false;
    }

    if (newActiveScrollControl !== isUnderScrollControl) {
      setIsUnderScrollControl(newActiveScrollControl);
    }

    if (newActiveScrollControl) {
      if (Math.abs(newTime - video.currentTime) > 0.035) { // Tolerance for update
        video.currentTime = newTime;
        // logger.debug(`[ScrollVideo] ${src.split('/').pop()} Time: ${newTime.toFixed(2)} (Top: ${videoTop.toFixed(0)}, Prog: ${(newTime/videoDuration).toFixed(2)})`);
      }
    }
  }, [videoDuration, isVisible, isUnderScrollControl, src]); // Added src to dependencies

  // RAF-throttled scroll handler
  const masterScrollHandler = useCallback(() => {
    const now = performance.now();
    if (now - lastRAFTimeRef.current < 30) { // Throttle to ~33fps
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
      return;
    }
    lastRAFTimeRef.current = now;
    
    updateVideoPlayback(); // Call the core logic

    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [updateVideoPlayback]);


  // Main effect to manage video state (looping/paused) and scroll listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) return;

    if (isUnderScrollControl && isVisible) {
      // Scroll control is active
      video.loop = false;
      if (!video.paused && video.duration > 0) {
        video.pause();
      }
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Scroll control ACTIVE. Attaching RAF.`);
      
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      // Initial call to sync position correctly when scroll control becomes active
      updateVideoPlayback(); // Recalculate current time based on scroll
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler); // Start RAF

      window.addEventListener('scroll', masterScrollHandler, { passive: true });
      window.addEventListener('resize', masterScrollHandler, { passive: true });

      return () => {
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} Scroll control ended or video hidden. Removing RAF & listeners.`);
        window.removeEventListener('scroll', masterScrollHandler);
        window.removeEventListener('resize', masterScrollHandler);
        if (scrollRAFRef.current) {
          cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = null;
        }
      };
    } else {
      // Not under scroll control OR not visible => should loop
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} LOOPING (isUnderScrollControl: ${isUnderScrollControl}, isVisible: ${isVisible}).`);
      if (video.duration > 0) { // Ensure duration is known before setting currentTime
          if (video.currentTime !== 0) video.currentTime = 0; // Reset to start only if not already there
      }
      video.loop = true;
      if (video.paused) { // Only play if paused to avoid interrupting if already looping
        video.play().catch(error => {
            logger.warn(`[ScrollVideo] ${src.split('/').pop()} Autoplay for loop failed:`, error.message);
        });
      }
      
      // Ensure RAF is stopped if we transition out of scroll control
      if (scrollRAFRef.current) {
        cancelAnimationFrame(scrollRAFRef.current);
        scrollRAFRef.current = null;
      }
    }
  }, [isUnderScrollControl, isVisible, videoDuration, masterScrollHandler, src, updateVideoPlayback]);

  return (
    <div ref={containerRef} className={cn('w-full relative', className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-auto block"
        preload="metadata"
        playsInline
        muted
      >
        Your browser does not support the video tag.
      </video>
      {videoDuration === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          Loading video...
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);