"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { debugLogger as logger } from '@/lib/debugLogger';

interface ScrollControlledVideoPlayerProps {
  src: string;
  className?: string;
  intersectionThreshold?: number | number[];
}

const ScrollControlledVideoPlayer: React.FC<ScrollControlledVideoPlayerProps> = ({
  src,
  className,
  intersectionThreshold = 0.001, // More sensitive threshold
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isVisible, setIsVisible] = useState(false); 
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isUnderScrollControl, setIsUnderScrollControl] = useState(false); 

  const [debugCalculatedTime, setDebugCalculatedTime] = useState(0);
  const [debugCalculatedProgress, setDebugCalculatedProgress] = useState(0);
  const [debugIsLooping, setDebugIsLooping] = useState(false);
  const [debugVideoTop, setDebugVideoTop] = useState(0);
  const [debugVideoBottom, setDebugVideoBottom] = useState(0);

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
        } else {
            // Safari might report 0 duration initially for some MP4s
            const handleCanPlay = () => {
                if (video.duration > 0) {
                    logger.log(`[ScrollVideo] Duration resolved on canplay for ${src.split('/').pop()}: ${video.duration}s`);
                    setVideoDuration(video.duration);
                }
                video.removeEventListener('canplay', handleCanPlay);
            };
            video.addEventListener('canplay', handleCanPlay);
        }
        if (video.readyState < 1) { 
            video.load(); 
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      if (video.readyState >= 1 && video.duration > 0) { 
        onLoadedMetadata();
      }
      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
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
        const videoTop = rect.top;
        const videoBottom = rect.bottom;
        const videoHeight = rect.height;
        
        if (showDebugOverlay) {
          setDebugVideoTop(videoTop);
          setDebugVideoBottom(videoBottom);
        }
        
        // Condition for scroll control: top of video is at or above viewport top, 
        // AND bottom of video is still within viewport.
        if (videoTop <= 0 && videoBottom > 0) {
            shouldBeScrollControlled = true;
            // Progress is based on how much of the video's height has passed the top of the viewport
            newProgress = Math.min(1, Math.max(0, (-videoTop) / videoHeight));
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
      // Ensure time is within bounds, especially at the very end
      const targetTime = Math.min(newTime, videoDuration || newTime);
      if (Math.abs(targetTime - videoRef.current.currentTime) > 0.035) { 
        videoRef.current.currentTime = targetTime;
      }
    }
    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [calculatePlaybackState, src, videoDuration]);

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
    const videoBottom = rect ? rect.bottom : 0;

    logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect running. Visible: ${localIsVisible}, ScrollControl: ${localIsUnderScrollControl}, Top: ${videoTop.toFixed(0)}, Bottom: ${videoBottom.toFixed(0)}`);
    
    if (showDebugOverlay) setDebugIsLooping(video.loop);

    // Clear previous listeners and RAF
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
    } else { // Is Visible
        if (localIsUnderScrollControl) {
            logger.debug(`[ScrollVideo ${src.split('/').pop()}] Under Scroll Control. Paused, loop=false.`);
            video.loop = false;
            if (showDebugOverlay) setDebugIsLooping(false);
            if (!video.paused) video.pause();
            
            // Call calculatePlaybackState once to set initial time if needed
            const { newTime } = calculatePlaybackState();
            if (newTime !== undefined && videoRef.current && Math.abs(newTime - videoRef.current.currentTime) > 0.035) {
                 videoRef.current.currentTime = Math.min(newTime, videoDuration || newTime);
            }

            scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
            window.addEventListener('scroll', masterScrollHandler, { passive: true });
            window.addEventListener('resize', masterScrollHandler, { passive: true });
        } else { // Visible, but NOT under scroll control
            if (videoBottom <= 0 && videoTop < 0) { // Video has scrolled completely past the top of viewport
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible (passed top), Not ScrollControlled. Looping from end.`);
                if (video.readyState >= 3 && !video.seeking) { // Ensure video is ready
                    video.currentTime = videoDuration - 0.01; // Start near the end for loop
                }
                video.loop = true;
                if (showDebugOverlay) setDebugIsLooping(true);
                if (video.paused) {
                    video.play().catch(e => logger.warn(`[ScrollVideo Play Fail ${src.split('/').pop()}] PassedTop Loop: ${e.message}`));
                }
            } else { // Video is visible but either entering from bottom or not yet in scroll control zone
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible, Not ScrollControlled, Initial/Bottom. Frame 0, paused.`);
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
  }, [isUnderScrollControl, isVisible, videoDuration, masterScrollHandler, src, showDebugOverlay, calculatePlaybackState]);

  return (
    <div ref={containerRef} className={cn('w-full relative', className)}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-auto block"
        preload="metadata" 
        playsInline
        muted
        // loop // Default to loop, JS will manage it
      >
        Your browser does not support the video tag.
      </video>
      {videoDuration === null && isVisible && ( // Show loader only if visible and duration not yet set
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white backdrop-blur-sm">
          Loading video metadata...
        </div>
      )}
      {showDebugOverlay && (
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded font-mono z-10 pointer-events-none max-w-[calc(100%-1rem)] overflow-hidden">
          <div>Src: {src.split('/').pop()?.substring(0,30)}</div>
          <div>ScrollCtrl: {isUnderScrollControl ? 'YES' : 'NO'}</div>
          <div>Looping: {debugIsLooping ? 'YES' : 'NO'}</div>
          <div>Visible(IO): {isVisible ? 'YES' : 'NO'}</div>
          <div>Top: {debugVideoTop.toFixed(0)}, Bot: {debugVideoBottom.toFixed(0)}</div>
          <div>CalcPrg: {debugCalculatedProgress.toFixed(3)}</div>
          <div>CalcTime: {debugCalculatedTime.toFixed(3)}s</div>
          <div>ActualTime: {videoRef.current?.currentTime?.toFixed(3) ?? 'N/A'}s</div>
          <div>Duration: {videoDuration?.toFixed(2) ?? 'N/A'}s</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);