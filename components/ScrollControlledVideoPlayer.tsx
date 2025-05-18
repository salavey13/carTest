// /components/ScrollControlledVideoPlayer.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

interface ScrollControlledVideoPlayerProps {
  src: string;
  className?: string;
  intersectionThreshold?: number | number[];
  scrollPlayFactor?: number; 
}

const ScrollControlledVideoPlayer: React.FC<ScrollControlledVideoPlayerProps> = ({
  src,
  className,
  intersectionThreshold = 0.01,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isVisible, setIsVisible] = useState(false); 
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isUnderScrollControl, setIsUnderScrollControl] = useState(false); 

  const lastRAFTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

  useEffect(() => {
    logger.log(`[ScrollVideo EASTER_EGG] Player for ${src.split('/').pop()} initialized. Get ready to VIBE with the scroll! ::FaSatelliteDish::`);
  }, [src]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const newVisibility = entry.isIntersecting;
      if (isVisible !== newVisibility) {
        logger.debug(`[ScrollVideo] Video ${src.split('/').pop()} visibility changed to: ${newVisibility}`);
        setIsVisible(newVisibility);
      }
    });
  }, [src, isVisible]);

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

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const onLoadedMetadata = () => {
        logger.log(`[ScrollVideo] Metadata loaded for ${src.split('/').pop()}: duration ${video.duration}s, readyState ${video.readyState}`);
        setVideoDuration(video.duration);
        if (video.readyState < 1) { 
            video.load(); 
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      if (video.readyState >= 1) { 
        onLoadedMetadata();
      }
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    }
  }, [src]);

  const updateVideoPlayback = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container || videoDuration === null || videoDuration === 0) {
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

    // NEW LOGIC: Scroll control is active when the video FITS ENTIRELY in the viewport
    const fitsEntirelyInViewport = videoTop >= 0 && videoBottom <= viewportHeight;

    if (fitsEntirelyInViewport && isVisible) {
        newActiveScrollControl = true;
        // Calculate the total scrollable distance for the video's top edge within the viewport
        const scrollableDistanceInViewport = viewportHeight - videoHeight;
        
        if (scrollableDistanceInViewport > 0) { // Video is shorter than viewport
            // Progress is based on how much the video's top has moved from the viewport's top
            // relative to the total space it can move.
            const scrolledDistance = videoTop; // videoTop is 0 when at top, scrollableDistanceInViewport when at bottom
            let progress = scrolledDistance / scrollableDistanceInViewport;
            // Invert progress: 0 when videoTop is at max (bottom), 1 when videoTop is 0 (top)
            progress = 1 - progress; 
            progress = Math.max(0, Math.min(1, progress));
            newTime = progress * videoDuration;
        } else { // Video is as tall as or taller than viewport; scroll control based on its position
            let progress = (viewportHeight - videoTop) / videoHeight; // Fraction of video scrolled past the top
            progress = Math.max(0, Math.min(1, progress)); // Clamp between 0 and 1
            newTime = progress * videoDuration;
        }

    } else {
      newActiveScrollControl = false;
    }

    if (newActiveScrollControl !== isUnderScrollControl) {
      setIsUnderScrollControl(newActiveScrollControl);
      logger.log(`[ScrollVideo EASTER_EGG] ${src.split('/').pop()} Scroll Control State: ${newActiveScrollControl ? 'ENGAGED ::FaRobot::' : 'DISENGAGED (Looping Active) ::FaUndo::'}`);
    }

    if (newActiveScrollControl) {
      if (Math.abs(newTime - video.currentTime) > 0.035) { 
        video.currentTime = newTime;
      }
    }
  }, [videoDuration, isVisible, isUnderScrollControl, src]);

  const masterScrollHandler = useCallback(() => {
    const now = performance.now();
    if (now - lastRAFTimeRef.current < 30) { 
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
      return;
    }
    lastRAFTimeRef.current = now;
    updateVideoPlayback();
    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [updateVideoPlayback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) return;

    if (isUnderScrollControl && isVisible) {
      video.loop = false;
      if (!video.paused && video.duration > 0) {
        video.pause();
      }
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Scroll control ACTIVE. Attaching RAF.`);
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      updateVideoPlayback(); 
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
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
      // Loop when not under scroll control OR not visible
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} LOOPING (isUnderScrollControl: ${isUnderScrollControl}, isVisible: ${isVisible}).`);
      if (video.duration > 0) { 
          if (video.currentTime !== 0) video.currentTime = 0; 
      }
      video.loop = true;
      if (video.paused && isVisible) { // Play only if paused AND visible
        video.play().catch(error => {
            logger.warn(`[ScrollVideo] ${src.split('/').pop()} Autoplay for loop failed:`, error.message);
        });
      } else if (!isVisible && !video.paused) { // Pause if it becomes not visible while looping
        video.pause();
      }
      
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