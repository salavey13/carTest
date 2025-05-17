"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

interface ScrollControlledVideoPlayerProps {
  src: string;
  className?: string;
  intersectionThreshold?: number | number[];
  // scrollPlayFactor is not used, can be removed from props if not planned for future
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
  const [debugCalculatedTime, setDebugCalculatedTime] = useState(0);
  const [debugCalculatedProgress, setDebugCalculatedProgress] = useState(0);
  const [debugIsLooping, setDebugIsLooping] = useState(false);
  const [debugVideoTop, setDebugVideoTop] = useState(0);

  const lastRAFTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

  const showDebugOverlay = process.env.NEXT_PUBLIC_USE_MOCK_USER === 'true';

  const isUnderScrollControlRef = useRef(isUnderScrollControl);
  const isVisibleRef = useRef(isVisible);

  useEffect(() => {
    isUnderScrollControlRef.current = isUnderScrollControl;
  }, [isUnderScrollControl]);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  useEffect(() => {
    logger.log(`[ScrollVideo] Player for ${src.split('/').pop()} initialized.`);
  }, [src]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      const newVisibility = entry.isIntersecting;
      if (isVisibleRef.current !== newVisibility) { 
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} visibility changed via IO to: ${newVisibility}`);
        setIsVisible(newVisibility);
      }
    });
  }, [src]); 

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: intersectionThreshold, 
      rootMargin: "0px 0px 0px 0px" 
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
        if (video.duration > 0) {
          setVideoDuration(video.duration);
        }
        if (video.readyState < 1) { 
            video.load(); 
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      if (video.readyState >= 1 && video.duration > 0) { 
        onLoadedMetadata();
      } else if (video.readyState >=1 && video.duration === 0) {
        const checkDuration = () => {
            if (video.duration > 0) {
                setVideoDuration(video.duration);
                video.removeEventListener('canplay', checkDuration);
            }
        }
        video.addEventListener('canplay', checkDuration)
      }
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        // video.removeEventListener('canplay', checkDuration); // Potentially, if checkDuration was added
      };
    }
  }, [src]);

  const calculatePlaybackState = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    let shouldBeScrollControlled = false;
    let newTime = video?.currentTime ?? 0;
    let newProgress = video && videoDuration ? (video.currentTime / videoDuration) : 0;

    if (video && container && videoDuration && isVisibleRef.current) {
        const rect = container.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const videoTop = rect.top;
        const videoBottom = rect.bottom;
        const videoHeight = rect.height;
        
        if (showDebugOverlay) setDebugVideoTop(videoTop);

        const isFullyVisibleInViewport = videoTop >= 0 && videoBottom <= viewportHeight;

        if (isFullyVisibleInViewport) {
            shouldBeScrollControlled = true;
            const scrollableDistanceInViewport = viewportHeight - videoHeight;
            
            if (scrollableDistanceInViewport > 0) { 
                const scrolledDistance = videoTop; 
                newProgress = 1 - (scrolledDistance / scrollableDistanceInViewport); 
            } else { 
                newProgress = (viewportHeight - videoTop) / videoHeight; 
            }
            newProgress = Math.max(0, Math.min(1, newProgress));
            newTime = newProgress * videoDuration;
        }
    }
    
    if (showDebugOverlay) {
        setDebugCalculatedProgress(newProgress);
        setDebugCalculatedTime(newTime);
    }
    return { shouldBeScrollControlled, newTime };
  }, [videoDuration, src, showDebugOverlay]);

  const masterScrollHandler = useCallback(() => {
    const now = performance.now();
    if (now - lastRAFTimeRef.current < 16) { 
      scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
      return;
    }
    lastRAFTimeRef.current = now;
    
    const { shouldBeScrollControlled, newTime } = calculatePlaybackState();

    if (shouldBeScrollControlled !== isUnderScrollControlRef.current) {
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Scroll Control state changing from ${isUnderScrollControlRef.current} to ${shouldBeScrollControlled}`);
      setIsUnderScrollControl(shouldBeScrollControlled);
    }

    if (shouldBeScrollControlled && videoRef.current && newTime !== undefined) {
      if (Math.abs(newTime - videoRef.current.currentTime) > 0.035) { 
        videoRef.current.currentTime = newTime;
      }
    }
    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [calculatePlaybackState, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) {
        logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect: Video or duration not ready. Cleanup and return.`);
        window.removeEventListener('scroll', masterScrollHandler);
        window.removeEventListener('resize', masterScrollHandler);
        if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
        return;
    }

    const localIsVisible = isVisibleRef.current;
    const localIsUnderScrollControl = isUnderScrollControlRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    const videoTop = rect ? rect.top : 0;

    logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect running. Visible: ${localIsVisible}, ScrollControl: ${localIsUnderScrollControl}, Top: ${videoTop.toFixed(0)}`);
    
    if (showDebugOverlay) setDebugIsLooping(video.loop);

    window.removeEventListener('scroll', masterScrollHandler);
    window.removeEventListener('resize', masterScrollHandler);
    if (scrollRAFRef.current) {
      cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = null;
    }

    if (!localIsVisible) {
        logger.debug(`[ScrollVideo ${src.split('/').pop()}] Not Visible. Pausing, loop=false, time=0.`);
        if (!video.paused) video.pause();
        video.loop = false;
        if (video.currentTime !== 0 && !video.seeking) video.currentTime = 0;
        if (showDebugOverlay) setDebugIsLooping(false);
    } else { 
        if (localIsUnderScrollControl) {
            logger.debug(`[ScrollVideo ${src.split('/').pop()}] Under Scroll Control. Paused, loop=false.`);
            video.loop = false;
            if (showDebugOverlay) setDebugIsLooping(false);
            if (!video.paused) video.pause();
            
            scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
            window.addEventListener('scroll', masterScrollHandler, { passive: true });
            window.addEventListener('resize', masterScrollHandler, { passive: true });
        } else { 
            if (videoTop < 0) { 
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible, Not ScrollControlled, Overflow_TOP. Looping.`);
                if (video.currentTime !== 0 && !video.seeking && video.readyState >= 3) video.currentTime = 0;
                video.loop = true;
                if (showDebugOverlay) setDebugIsLooping(true);
                if (video.paused) {
                    video.play().catch(e => logger.warn(`[ScrollVideo Play Fail ${src.split('/').pop()}] OverflowTop Loop: ${e.message}`));
                }
            } else { 
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible, Not ScrollControlled, Initial/Overflow_BOTTOM. Frame 0, paused.`);
                video.loop = false;
                if (showDebugOverlay) setDebugIsLooping(false);
                if (!video.paused) video.pause();
                if (video.currentTime !== 0 && !video.seeking && video.readyState >= 1) video.currentTime = 0;
            }
        }
    }
    
    return () => { 
        logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect CLEANUP. Removing listeners and RAF.`);
        window.removeEventListener('scroll', masterScrollHandler);
        window.removeEventListener('resize', masterScrollHandler);
        if (scrollRAFRef.current) {
            cancelAnimationFrame(scrollRAFRef.current);
            scrollRAFRef.current = null;
        }
    };
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
      >
        Your browser does not support the video tag.
      </video>
      {videoDuration === null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          Loading video metadata...
        </div>
      )}
      {showDebugOverlay && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded font-mono z-10 pointer-events-none max-w-[calc(100%-1rem)] overflow-hidden">
          <div>Src: {src.split('/').pop()?.substring(0,30)}</div>
          <div>ScrollControlled: {isUnderScrollControl ? 'YES' : 'NO'}</div>
          <div>Looping: {debugIsLooping ? 'YES' : 'NO'}</div>
          <div>Visible (IO): {isVisible ? 'YES' : 'NO'}</div>
          <div>VideoTop: {debugVideoTop.toFixed(0)}</div>
          <div>Calc Prog: {debugCalculatedProgress.toFixed(3)}</div>
          <div>Calc Time: {debugCalculatedTime.toFixed(3)}s</div>
          <div>Actual Time: {videoRef.current?.currentTime?.toFixed(3) ?? 'N/A'}s</div>
          <div>Duration: {videoDuration?.toFixed(2) ?? 'N/A'}s</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);