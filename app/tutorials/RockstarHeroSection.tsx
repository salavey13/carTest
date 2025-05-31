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
  const [isVisible, setIsVisible] = useState(false);
  const fixedHeroContainerRef = useRef<HTMLDivElement>(null);
  // fadeOverlayRef is not strictly needed if we control opacity based on heroContentOverallOpacity for it too
  
  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        // Update scrollProgress based on intersection and bounding box
        // This logic ensures progress is updated even when not actively scrolling but intersection changes
        if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const viewportHeight = window.innerHeight;
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        } else {
            const rect = entry.boundingClientRect;
            if (rect.bottom < 0) setScrollProgress(1); // Fully scrolled past
            else if (rect.top > viewportHeight) setScrollProgress(0); // Fully scrolled before
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
            // Calculate progress based on how much of the trigger element has passed the top of the viewport
            // or how much is visible from the bottom.
            // This ensures a smooth 0 to 1 progress as the trigger element scrolls through the viewport.
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        }
    };

    if (isVisible) { 
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial call to set progress
    } else {
        window.removeEventListener('scroll', handleScroll);
    }
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible, triggerElementSelector]);

  // Adjusted thresholds: content starts fading earlier and finishes fading earlier.
  const contentFadeThresholds = {
    start: 0.35, // Start fading content (title, subtitle, children, main BG) at 35% scroll of trigger
    end: 0.75,   // Content fully faded by 75% scroll of trigger
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  
  // Calculate progress for content fading
  let contentFadeProgress = 0;
  if (scrollProgress >= contentFadeThresholds.start) {
    contentFadeProgress = Math.min(1, (scrollProgress - contentFadeThresholds.start) / (contentFadeThresholds.end - contentFadeThresholds.start));
  } else if (scrollProgress < contentFadeThresholds.start) {
    contentFadeProgress = 0; // Fully visible before start threshold
  }
  const heroContentOverallOpacity = 1 - contentFadeProgress;

  // Main BG scale and translate logic (can still use original scrollProgress or tie to contentFade)
  // For simplicity, let's keep it tied to the raw scrollProgress for now, but fade with heroContentOverallOpacity
  let mainBgScaleProgress = Math.min(1, scrollProgress / 0.65); // Scale happens up to 65%
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 1; // Minimal translate, scaling does most work

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 3; 
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 

  // The bottom gradient fade overlay now also uses heroContentOverallOpacity to fade along with content
  // Or, it can have its own timing if you want it to linger or fade differently.
  // For simplicity, let's make it fade with the content.
  // fadeOverlayProgress is essentially contentFadeProgress

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden z-10" // Added z-10
        style={{
            opacity: isVisible ? 1 : 0, 
            pointerEvents: isVisible ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out', 
        }}
    >
        {/* Layer 1: Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30" // Stays behind all hero content
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
            opacity: heroContentOverallOpacity, // Fades with other content
          }}
        />
        
        {/* Layer 2: Decorative Background Object */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none" // Above main BG, below title
            style={{
              opacity: bgObjectOpacity * heroContentOverallOpacity, // Also fades with content
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
        
        {/* Layer 3: Title (Static, centrally aligned) */}
        <div className="relative text-center px-4" style={{ opacity: heroContentOverallOpacity }}> {/* Default z-index, effectively on top of -z layers */}
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
        
        {/* Gradient Fade Overlay - to make bottom content blend into page background */}
        <div
          className="absolute inset-0 pointer-events-none" // Stays above decorative BGs, below bottom content
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 60%, hsl(var(--background)) 95%)`, // Gradient starts higher, ends stronger
            opacity: 1, // Always visible to create the fade effect for the hero itself
            zIndex: 5, // Ensures it's above background elements but below UI text/buttons
          }}
        />
        
        {/* Layer 6: Subtitle and Children (Buttons, etc.) */}
        <div 
            className="absolute bottom-[8vh] md:bottom-[10vh] w-full px-4 text-center flex flex-col items-center gap-4 md:gap-6" 
            style={{ 
                opacity: heroContentOverallOpacity, // Fades with all other content
                transition: 'opacity 0.2s ease-in-out', // Faster fade for content
                zIndex: 10, // Ensures it's above the gradient fade overlay
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