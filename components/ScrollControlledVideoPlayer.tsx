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
  intersectionThreshold = [0, 0.01, 0.99, 1], // Sensitive thresholds
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
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} visibility changed via IO to: ${newVisibility} (boundingClientRect.top: ${entry.boundingClientRect.top.toFixed(0)})`);
        setIsVisible(newVisibility);
      }
    });
  }, [src]); 

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      threshold: intersectionThreshold, 
      rootMargin: "0px 0px -1px 0px" 
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
        const onCanPlayHandler = () => {
            if (video.duration > 0 && videoDuration !== video.duration) {
                logger.log(`[ScrollVideo] Duration resolved on canplay for ${src.split('/').pop()}: ${video.duration}s`);
                setVideoDuration(video.duration);
            }
            video.removeEventListener('canplay', onCanPlayHandler); // Important to remove
        };
        
        const onLoadedMetadataHandler = () => {
            if (video.duration > 0 && videoDuration !== video.duration) {
                logger.log(`[ScrollVideo] Metadata loaded for ${src.split('/').pop()}: duration ${video.duration}s, readyState ${video.readyState}`);
                setVideoDuration(video.duration);
            } else if (video.duration === 0 && video.networkState > video.NETWORK_EMPTY && video.networkState < video.NETWORK_NO_SOURCE) {
                // Duration is 0 but network state suggests it's trying to load, or has partial data.
                // Listen for canplay as a fallback.
                logger.warn(`[ScrollVideo] Duration 0 after loadedmetadata for ${src.split('/').pop()}, readyState ${video.readyState}. Attaching canplay listener.`);
                video.addEventListener('canplay', onCanPlayHandler);
            }
            // Ensure video loads if it hasn't started due to preload="metadata" and autoplay restrictions
            if (video.networkState === video.NETWORK_IDLE && video.readyState < video.HAVE_METADATA) {
                 video.load();
            }
        };
      
      video.addEventListener('loadedmetadata', onLoadedMetadataHandler);
      
      // Check if metadata might already be loaded
      if (video.readyState >= video.HAVE_METADATA) {
        onLoadedMetadataHandler(); // Call handler to process if already available
      } else if (video.networkState === video.NETWORK_EMPTY || video.networkState === video.NETWORK_NO_SOURCE) {
        video.load(); // Explicitly call load if it's in an empty state
      }

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadataHandler);
        video.removeEventListener('canplay', onCanPlayHandler); // Ensure cleanup
      };
    }
  }, [src, videoDuration]); // videoDuration in deps to re-evaluate if it was initially null/0 and changed

  const calculatePlaybackState = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    let shouldBeScrollControlled = false;
    let newTime = video?.currentTime ?? 0;
    let newProgress = video && videoDuration && videoDuration > 0 ? (video.currentTime / videoDuration) : 0;

    if (video && container && videoDuration && videoDuration > 0 && isVisibleRef.current) {
        const rect = container.getBoundingClientRect();
        const videoTop = rect.top;
        const videoBottom = rect.bottom;
        const videoHeight = rect.height;
        
        if (showDebugOverlay) {
          setDebugVideoTop(videoTop);
          setDebugVideoBottom(videoBottom);
        }
        
        if (videoHeight > 0 && videoTop <= 0 && videoBottom > 0) { 
            shouldBeScrollControlled = true;
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

    if (shouldBeScrollControlled && videoRef.current && videoDuration && videoDuration > 0 && newTime !== undefined) {
      const targetTime = Math.min(newTime, videoDuration); 
      if (Math.abs(targetTime - videoRef.current.currentTime) > 0.035) { 
        videoRef.current.currentTime = targetTime;
      }
    }
    scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
  }, [calculatePlaybackState, src, videoDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null || videoDuration === 0) {
        logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect: Video or valid duration not ready. Cleanup and return. Duration: ${videoDuration}`);
        window.removeEventListener('scroll', masterScrollHandler);
        window.removeEventListener('resize', masterScrollHandler);
        if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
        if (video && !video.paused) video.pause();
        if (video) video.loop = false;
        return;
    }

    const localIsVisible = isVisibleRef.current;
    const localIsUnderScrollControl = isUnderScrollControlRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    const videoTop = rect ? rect.top : 0;
    const videoBottom = rect ? rect.bottom : 0;

    logger.debug(`[ScrollVideo ${src.split('/').pop()}] Effect logic. Visible: ${localIsVisible}, ScrollCtrl: ${localIsUnderScrollControl}, Top: ${videoTop.toFixed(0)}, Bottom: ${videoBottom.toFixed(0)}, Duration: ${videoDuration}`);
    
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
            
            const { newTime } = calculatePlaybackState();
            if (newTime !== undefined && videoRef.current && Math.abs(newTime - videoRef.current.currentTime) > 0.035) {
                 videoRef.current.currentTime = Math.min(newTime, videoDuration);
            }

            scrollRAFRef.current = requestAnimationFrame(masterScrollHandler);
            window.addEventListener('scroll', masterScrollHandler, { passive: true });
            window.addEventListener('resize', masterScrollHandler, { passive: true });
        } else { 
            if (videoBottom <= 0 && videoTop < 0) { 
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible (passed top), Not ScrollControlled. Looping from end.`);
                if (video.readyState >= video.HAVE_METADATA && !video.seeking) { // HAVE_METADATA might be enough here
                    // Ensure currentTime is not set beyond duration
                    video.currentTime = Math.max(0, videoDuration - 0.1); // slightly before end to ensure loop plays
                }
                video.loop = true;
                if (showDebugOverlay) setDebugIsLooping(true);
                if (video.paused) {
                    video.play().catch(e => logger.warn(`[ScrollVideo Play Fail ${src.split('/').pop()}] PassedTop Loop: ${e.message}`));
                }
            } else { 
                logger.debug(`[ScrollVideo ${src.split('/').pop()}] Visible, Not ScrollControlled, Initial/Bottom. Frame 0, paused.`);
                video.loop = false;
                if (showDebugOverlay) setDebugIsLooping(false);
                if (!video.paused) video.pause();
                if (video.currentTime !== 0 && !video.seeking && video.readyState >= video.HAVE_METADATA) video.currentTime = 0;
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
    <div ref={containerRef} className={cn('w-full relative bg-black', className)}>
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
      {isVisible && (videoDuration === null || videoDuration === 0) && ( 
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
          <div>ReadyState: {videoRef.current?.readyState}</div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ScrollControlledVideoPlayer);