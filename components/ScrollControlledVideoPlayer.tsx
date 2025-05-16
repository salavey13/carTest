"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

interface ScrollControlledVideoPlayerProps {
  src: string;
  className?: string;
  // Threshold for IntersectionObserver, defines how much of the target is visible for callback
  intersectionThreshold?: number | number[];
  // Defines how much the scroll should "overshoot" the video element
  // before video.currentTime reaches video.duration.
  // 0 means video ends when its bottom reaches viewport top.
  // 1 means video ends when its bottom reaches viewport bottom (it has fully scrolled past).
  scrollPlayFactor?: number; // 0 to 1, default 0.5
}

const ScrollControlledVideoPlayer: React.FC<ScrollControlledVideoPlayerProps> = ({
  src,
  className,
  intersectionThreshold = 0.01, // Becomes active as soon as 1% is visible
  scrollPlayFactor = 0.5, // Video progresses over its own height + 50% of viewport height
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isLoopingOutOfView, setIsLoopingOutOfView] = useState(false);

  const lastScrollTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

  // Callback for IntersectionObserver
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        logger.debug(`[ScrollVideo] Video ${src.split('/').pop()} became VISIBLE`);
        setIsVisible(true);
      } else {
        logger.debug(`[ScrollVideo] Video ${src.split('/').pop()} became HIDDEN`);
        setIsVisible(false);
      }
    });
  }, [src]);

  // Effect for IntersectionObserver
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
      }
    };
  }, [handleIntersection, intersectionThreshold]);

  // Effect for video metadata
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const onLoadedMetadata = () => {
        logger.log(`[ScrollVideo] Metadata loaded for ${src.split('/').pop()}: duration ${video.duration}s`);
        setVideoDuration(video.duration);
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      if (video.readyState >= 1) { // Check if metadata already loaded
        onLoadedMetadata();
      }
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    }
  }, [src]);

  // Scroll handler using requestAnimationFrame
  const handleScroll = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container || videoDuration === null || !isVisible || isLoopingOutOfView) {
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = null;
      return;
    }

    const now = performance.now();
    // Throttle updates to roughly 30fps max for performance
    if (now - lastScrollTimeRef.current < 30) { 
      scrollRAFRef.current = requestAnimationFrame(handleScroll);
      return;
    }
    lastScrollTimeRef.current = now;

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Calculate the total scroll distance over which the video playback is controlled.
    // This is the height of the video element plus a factor of the viewport height.
    // factor = 0: video plays fully as it scrolls its own height across the viewport.
    // factor = 1: video plays fully as it scrolls its own height + one viewportHeight.
    const effectiveScrollPlayFactor = Math.max(0, Math.min(1, scrollPlayFactor));
    const scrollWindowHeight = rect.height + viewportHeight * effectiveScrollPlayFactor;
    
    // Calculate progress:
    // 0 when the top of the video is at the bottom of the viewport (or slightly before based on scrollPlayFactor adjustment).
    // 1 when the bottom of the video is at the top of the viewport (or slightly after).
    // `distanceFromViewportBottomToVideoTop` measures how far the video's top has moved up from the viewport bottom.
    const distanceFromViewportBottomToVideoTop = viewportHeight - rect.top;
    
    let progress = distanceFromViewportBottomToVideoTop / scrollWindowHeight;
    progress = Math.max(0, Math.min(1, progress)); // Clamp progress between 0 and 1.

    const newTime = progress * videoDuration;

    // Only update currentTime if it has changed significantly to avoid jitter
    if (Math.abs(newTime - video.currentTime) > 0.02) { // Approx 1/50th of a second
      video.currentTime = newTime;
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} newTime: ${newTime.toFixed(2)}, progress: ${progress.toFixed(2)} (rect.top: ${rect.top.toFixed(0)}, dist: ${distanceFromViewportBottomToVideoTop.toFixed(0)})`);
    }
    
    scrollRAFRef.current = requestAnimationFrame(handleScroll);
  }, [videoDuration, isVisible, isLoopingOutOfView, scrollPlayFactor, src]);


  // Effect to manage scroll listener and video state based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) return;

    if (isVisible) {
      setIsLoopingOutOfView(false);
      video.loop = false;
      if (!video.paused) video.pause();
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Attaching scroll listener.`);
      
      // Initial sync and start RAF loop
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = requestAnimationFrame(handleScroll);

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true }); // Also adjust on resize

      return () => {
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} Removing scroll listener.`);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
        if (scrollRAFRef.current) {
          cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = null;
        }
      };
    } else { // Not visible
      setIsLoopingOutOfView(true);
      video.currentTime = 0; // Reset to start as per user request
      video.loop = true;
      video.play().catch(error => {
        logger.warn(`[ScrollVideo] ${src.split('/').pop()} Autoplay failed when out of view:`, error.message);
      });
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Video playing in loop (out of view).`);
    }
  }, [isVisible, videoDuration, handleScroll, src]);

  return (
    <div ref={containerRef} className={cn('w-full relative', className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-auto block"
        preload="metadata"
        playsInline
        muted // Muted is generally required for programmatic play and good UX
      >
        Your browser does not support the video tag.
      </video>
      {videoDuration === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
          Loading video...
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);