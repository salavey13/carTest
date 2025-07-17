"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 

interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  children?: React.ReactNode; 
  triggerElementSelector: string;
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//Screenshot_2025-05-17-11-07-09-401_org.telegram.messenger.jpg", 
  backgroundImageObjectUrl, 
  children,
  triggerElementSelector,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const fixedHeroContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
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
      }, { rootMargin: '0px 0px 0px 0px', threshold: Array.from({ length: 101 }, (_, i) => i / 100) } 
    );
    observer.observe(triggerElement);

    return () => {
      if (triggerElement) observer.unobserve(triggerElement); 
    };
  }, [triggerElementSelector]); 

  const contentFadeThresholds = {
    start: 0.35,
    end: 0.75,
  };
  
  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  
  let contentFadeProgress = 0;
  if (scrollProgress >= contentFadeThresholds.start) {
    contentFadeProgress = Math.min(1, (scrollProgress - contentFadeThresholds.start) / (contentFadeThresholds.end - contentFadeThresholds.start));
  }
  const heroContentOverallOpacity = 1 - contentFadeProgress;

  let mainBgScaleProgress = Math.min(1, scrollProgress / 0.65);
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 1; 

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 3; 
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden z-10"
        style={{
            pointerEvents: scrollProgress >= 1 ? 'none' : 'auto',
        }}
    >
        {/* Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform, opacity',
            opacity: heroContentOverallOpacity,
          }}
        />
        
        {/* Decorative Object */}
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
        
        {/* Title */}
        <div className="relative text-center px-4" style={{ opacity: heroContentOverallOpacity, willChange: 'opacity' }}>
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold mb-4 md:mb-6",
              "gta-vibe-text-effect", 
              "animate-glitch"        
            )} 
            data-text={title}
          >
            <VibeContentRenderer content={title} />
          </h1>
        </div>
        
        {/* Gradient Fade Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--background)) 95%)`,
            zIndex: 5,
          }}
        />
        
        {/* Subtitle and Children */}
        <div 
            className="absolute bottom-20 w-full px-4 text-center flex flex-col items-center gap-4 md:gap-6" 
            style={{ 
                opacity: heroContentOverallOpacity,
                transition: 'opacity 0.2s ease-in-out',
                zIndex: 10,
                willChange: 'opacity'
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