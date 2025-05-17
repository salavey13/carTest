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
  const [isLoopingOutOfView, setIsLoopingOutOfView] = useState(false);

  const lastScrollTimeRef = useRef(0);
  const scrollRAFRef = useRef<number | null>(null);

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

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const onLoadedMetadata = () => {
        logger.log(`[ScrollVideo] Metadata loaded for ${src.split('/').pop()}: duration ${video.duration}s`);
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

  const handleScroll = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container || videoDuration === null || videoDuration === 0 || !isVisible || isLoopingOutOfView) {
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      scrollRAFRef.current = null;
      return;
    }

    const now = performance.now();
    if (now - lastScrollTimeRef.current < 30) { 
      scrollRAFRef.current = requestAnimationFrame(handleScroll);
      return;
    }
    lastScrollTimeRef.current = now;

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    let progress = (viewportHeight - rect.top) / viewportHeight;
    progress = Math.max(0, Math.min(1, progress));

    const newTime = progress * videoDuration;

    if (Math.abs(newTime - video.currentTime) > 0.03) { 
      video.currentTime = newTime;
    }
    
    scrollRAFRef.current = requestAnimationFrame(handleScroll);
  }, [videoDuration, isVisible, isLoopingOutOfView, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoDuration === null) return;

    if (isVisible) {
      setIsLoopingOutOfView(false);
      video.loop = false;
      if (!video.paused && video.duration > 0) { // Check duration before pausing
         video.pause();
      }
      logger.debug(`[ScrollVideo] ${src.split('/').pop()} Attaching scroll listener.`);
      
      if (scrollRAFRef.current) cancelAnimationFrame(scrollRAFRef.current);
      handleScroll(); 
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', handleScroll, { passive: true });

      return () => {
        logger.debug(`[ScrollVideo] ${src.split('/').pop()} Removing scroll listener.`);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
        if (scrollRAFRef.current) {
          cancelAnimationFrame(scrollRAFRef.current);
          scrollRAFRef.current = null;
        }
      };
    } else { 
      setIsLoopingOutOfView(true);
      if (video.duration > 0) video.currentTime = 0; // Check duration before setting time
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
        muted
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