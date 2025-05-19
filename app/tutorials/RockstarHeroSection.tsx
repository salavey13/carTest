"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 

// TextToSVGMask and related logic for mask are removed as per request to disable mask layer.

interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  // logoMaskPathD and logoMaskViewBox are removed as mask is disabled
  children?: React.ReactNode; 
  triggerElementSelector: string;
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//Screenshot_2025-05-17-11-07-09-401_org.telegram.messenger.jpg", 
  backgroundImageObjectUrl, 
  // logoMaskPathD, (removed)
  // logoMaskViewBox, (removed)
  children,
  triggerElementSelector,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const fixedHeroContainerRef = useRef<HTMLDivElement>(null);
  const fadeOverlayRef = useRef<HTMLDivElement>(null); 
  
  // UniqueMaskId and related logic are removed as mask is disabled.

  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const viewportHeight = window.innerHeight;
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        } else {
            const rect = entry.boundingClientRect;
            if (rect.bottom < 0) setScrollProgress(1); 
            else if (rect.top > window.innerHeight) setScrollProgress(0);
        }
      }, { threshold: Array.from({ length: 101 }, (_, i) => i / 100), rootMargin: "0px" } 
    );
    observer.observe(triggerElement);

    return () => {
      if (triggerElement) observer.unobserve(triggerElement); 
    };
  }, [triggerElementSelector]); 

  useEffect(() => {
    const handleScroll = () => {
        const currentTriggerEl = document.querySelector(triggerElementSelector);
        if(currentTriggerEl){
            const rect = currentTriggerEl.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        }
    };

    if (isVisible) { 
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); 
    } else {
        window.removeEventListener('scroll', handleScroll);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible, triggerElementSelector]);

  const scrollThresholds = {
    // maskZoomStart and maskZoomEnd are removed
    fadeOverlayStart: 0.65, 
    fadeOverlayEnd: 0.95,   
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  // Adjusted mainBgScaleProgress to depend on scrollProgress up to fadeOverlayStart
  let mainBgScaleProgress = 0;
  if (scrollThresholds.fadeOverlayStart > 0) {
    mainBgScaleProgress = Math.min(1, scrollProgress / scrollThresholds.fadeOverlayStart);
  } else {
    mainBgScaleProgress = scrollProgress >= 0.01 ? 1 : 0; // If fadeOverlayStart is 0, scale immediately
  }
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 1; 

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 3; 
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 

  // Mask related calculations (maskProgress, currentMaskScale, maskOverlayOpacity, svgMaskUrl) are removed.

  let fadeOverlayProgress = 0;
  if (scrollProgress >= scrollThresholds.fadeOverlayStart) {
    fadeOverlayProgress = Math.min(1, (scrollProgress - scrollThresholds.fadeOverlayStart) / (scrollThresholds.fadeOverlayEnd - scrollThresholds.fadeOverlayStart));
  }
  const heroContentOverallOpacity = 1 - fadeOverlayProgress; 

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
            opacity: isVisible ? 1 : 0, 
            pointerEvents: isVisible ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out', 
        }}
    >
        {/* Layer 1: Main Background -z-30 */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
            opacity: heroContentOverallOpacity, 
          }}
        />
        
        {/* Layer 2: Decorative Background Object -z-10 */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity * heroContentOverallOpacity, 
              transform: `scale(${bgObjectScale}) translateY(${bgObjectTranslateY}vh)`,
              willChange: 'opacity, transform',
            }}
          >
            <div 
              className="w-[60%] md:w-[40%] aspect-square bg-contain bg-no-repeat bg-center opacity-20"
              style={{ backgroundImage: `url(${backgroundImageObjectUrl})`}}
            ></div>
          </div>
        )}
        
        {/* Layer 3: Title (Static, centrally aligned) z-10 */}
        <div className="relative text-center px-4 z-10" style={{ opacity: heroContentOverallOpacity }}>
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold mb-4 md:mb-6",
              "gta-vibe-text-effect", 
              "animate-glitch"        
            )} 
            data-text={title}
          >
            <VibeContentRenderer content={title} />
          </h1>
          {/* Subtitle is moved to the bottom section */}
        </div>

        {/* Layer 4: Masked Overlay z-20 - REMOVED */}
        {/* SVG Mask Definitions - REMOVED */}
        
        {/* Gradient Fade Overlay - z-40 (above background, below content at bottom) */}
        <div
          ref={fadeOverlayRef}
          className="absolute inset-0 z-40 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 70%, hsl(var(--background)) 100%)`,
            opacity: fadeOverlayProgress, 
            willChange: 'opacity',
          }}
        />
        
        {/* Layer 6: Subtitle and Children (Buttons, etc.) z-50, at the bottom */}
        <div 
            className="absolute bottom-[8vh] md:bottom-[10vh] w-full px-4 text-center z-50 flex flex-col items-center gap-4 md:gap-6" 
            style={{ 
                opacity: heroContentOverallOpacity > 0.1 ? 1 : 0, 
                transition: 'opacity 0.3s ease-in-out' 
            }} 
        >
            {subtitle && (
                <p className="text-lg sm:text-xl md:text-2xl text-light-text/80 font-mono max-w-3xl mx-auto">
                    <VibeContentRenderer content={subtitle} />
                </p>
            )}
            {children && (
                <div className={cn(subtitle ? "mt-2 md:mt-4" : "")}>
                     {children}
                </div>
            )}
        </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;