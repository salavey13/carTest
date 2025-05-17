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

  // Debug states
  const [debugCurrentTime, setDebugCurrentTime] = useState(0);
  const [debugProgress, setDebugProgress] = useState(0);
  const [debugIsLooping, setDebugIsLooping] = useState(false);

  const lastRAFTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

  const showDebugOverlay = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true';

  // Refs for state values to be used in RAF callbacks
  const isUnderScrollControlRef = useRef(isUnderScrollControl);
  const isVisibleRef = useRef(isVisible);

  useEffect(() => {
    isUnderScrollControlRef.current = isUnderScrollControl;
  }, [isUnderScrollControl]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);


  useEffect(() => {
    logger.log(`[ScrollVideo EASTER_EGG] Player for ${src.split('/').pop()} initialized. Get ready to VIBE with the scroll! ::FaSatelliteDish::`);
  }, [src]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const newVisibility = entry.isIntersecting;
      // Check ref here to avoid race condition with state update
      if (isVisibleRef.current !== newVisibility) { 
        logger.debug(`[ScrollVideo] Video ${src.split('/').pop()} visibility changed via IntersectionObserver to: ${newVisibility}`);
        setIsVisible(newVisibility);
      }
    });
  }, [src]); // isVisibleRef is not needed as dependency since it's a ref

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

  const updateVideoPlayback = useCallback((): boolean => { // Returns if scroll control should be active
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container || videoDuration === null || videoDuration === 0) {
      if (showDebugOverlay) {
        setDebugProgress(0);
        setDebugCurrentTime(0);
      }
      return false; // Not under scroll control
    }

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const videoTop = rect.top;
    const videoBottom = rect.bottom;
    const videoHeight = rect.height;

    let newActiveScrollControl = false;
    let newTime = video.currentTime;
    let currentProgress = 0;

    const fitsEntirelyInViewport = videoTop >= 0 && videoBottom <= viewportHeight;

    if (fitsEntirelyInViewport && isVisibleRef.current) { // Use ref for isVisible
        newActiveScrollControl = true;
        const scrollableDistanceInViewport = viewportHeight - videoHeight;
        
        if (scrollableDistanceInViewport > 0) { 
            const scrolledDistance = videoTop; 
            currentProgress = 1 - (scrolledDistance / scrollableDistanceInViewport); 
            currentProgress = Math.max(0, Math.min(1, currentProgress));
            newTime = currentProgress * videoDuration;
        } else { 
            currentProgress = (viewportHeight - videoTop) / videoHeight; 
            currentProgress = Math.max(0, Math.min(1, currentProgress)); 
            newTime = currentProgress * videoDuration;
        }
        if (showDebugOverlay) {
            setDebugProgress(currentProgress);
            setDebugCurrentTime(newTime);
        }
        
        if (Math.abs(newTime - video.currentTime) > 0.035) { 
          video.currentTime = newTime;
        }
    }
    
    return newActiveScrollControl;
  }, [videoDuration, src, showDebugOverlay]); // Removed isVisible and isUnderScrollControl, using refs instead

  const masterScrollHandler = useCallback(() => {
    const now = performance.now();
    if (now - lastRAFTimeRef.current < 16) { // approx 60fps
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
      return;
    }
    lastRAFTimeRef.current = now;
    
    const shouldBeUnderScrollControl = updateVideoPlayback();
    if (shouldBeUnderScrollControl !== isUnderScrollControlRef.current) {
      logger.log(`[ScrollVideo EASTER_EGG] ${src.split('/').pop()} Scroll Control State CHANGED via masterScrollHandler to: ${shouldBeUnderScrollControl ? 'ENGAGED ::FaRobot::' : 'DISENGAGED (Looping Active) ::FaUndo::'}`);
      setIsUnderScrollControl(shouldBeUnderScrollControl);
    }

    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [updateVideoPlayback, src]); // updateVideoPlayback is stable

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) return;

    const localIsVisible = isVisibleRef.current;
    const localIsUnderScrollControl = isUnderScrollControlRef.current;

    if (localIsUnderScrollControl && localIsVisible) {
      video.loop = false;
      if (showDebugOverlay) setDebugIsLooping(false);
      if (!video.paused && video.duration > 0) {
        video.pause();
      }
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Scroll control ACTIVE. Attaching RAF.`);
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      // updateVideoPlayback(); // Initial call to set time based on current scroll
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
      
      window.addEventListener('scroll', masterScrollHandler, { passive: true });
      window.addEventListener('resize', masterScrollHandler, { passive: true });
      return () => {
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} Cleanup for SCROLL mode. Removing RAF & listeners.`);
        window.removeEventListener('scroll', masterScrollHandler);
        window.removeEventListener('resize', masterScrollHandler);
        if (scrollRAFRef.current) {
          cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = null;
        }
      };
    } else { // Not under scroll control OR not visible
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Setting up for LOOPING (isUnderScrollControl: ${localIsUnderScrollControl}, isVisible: ${localIsVisible}).`);
      if (video.duration > 0 && !video.seeking && video.currentTime !== 0) {
         // If it's visible but not scroll controlled, it should loop from start.
         // If not visible, it should be paused, currentTime reset is fine.
        video.currentTime = 0; 
      }
      video.loop = true;
      if (showDebugOverlay) setDebugIsLooping(true);

      if (localIsVisible) {
        if (video.paused) {
            video.play().catch(error => {
                logger.warn(`[ScrollVideo] ${src.split('/').pop()} Autoplay for loop failed:`, error.message);
            });
        }
      } else { // Not visible
        if (!video.paused) {
            video.pause();
        }
      }
      
      if (scrollRAFRef.current) { // Ensure RAF is cancelled if we switch to looping
        cancelAnimationFrame(scrollRAFRef.current);
        scrollRAFRef.current = null;
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} Cancelled RAF because switched to LOOPING/NOT_VISIBLE.`);
      }
       return () => {
         logger.debug(`[ScrollVideo] ${src.split('/').pop()} Cleanup for LOOPING/NOT_VISIBLE mode.`);
         // Ensure listeners are removed if they were somehow attached by a previous state
         window.removeEventListener('scroll', masterScrollHandler);
         window.removeEventListener('resize', masterScrollHandler);
         if (scrollRAFRef.current) {
          cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = null;
        }
       }
    }
  }, [isUnderScrollControl, isVisible, videoDuration, masterScrollHandler, src, showDebugOverlay]);


  return (
    <div ref={containerRef} className={cn('w-full relative', className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-auto block"
        preload="metadata"
        playsInline
        muted
        loop // Default to loop, JS will manage it
      >
        Your browser does not support the video tag.
      </video>
      {videoDuration === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          Loading video...
        </div>
      )}
      {showDebugOverlay && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded font-mono z-10 pointer-events-none">
          <div>Src: {src.split('/').pop()}</div>
          <div>ScrollControlled: {isUnderScrollControl ? 'YES' : 'NO'}</div>
          <div>Looping: {debugIsLooping ? 'YES' : 'NO'}</div>
          <div>Visible: {isVisible ? 'YES' : 'NO'}</div>
          <div>Progress: {debugProgress.toFixed(3)}</div>
          <div>Calc Time: {debugCurrentTime.toFixed(3)}s</div>
          <div>Actual Time: {videoRef.current?.currentTime?.toFixed(3) ?? 'N/A'}s</div>
          <div>Duration: {videoDuration?.toFixed(2) ?? 'N/A'}s</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);