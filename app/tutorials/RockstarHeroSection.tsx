"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  textToMask?: string; 
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; // For a large icon/object in the background layer
  // foregroundIconName?: string; // Temporarily removed for focus
  // foregroundIconSize?: string; 
  children?: React.ReactNode; 
  animationScrollHeightVH?: number; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  textToMask,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Screenshot_2025-05-18-01-29-18-375_org.telegram.messenger-a58d2b7f-775f-482f-ba0c-7735a3ca2335.jpg", 
  backgroundImageObjectUrl, 
  // foregroundIconName,    
  // foregroundIconSize = "text-6xl",
  children,
  animationScrollHeightVH = 200, // Default to 2 screen heights for animation
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); 
      rafId = requestAnimationFrame(() => {
        if (heroElement) { 
            const viewportHeight = window.innerHeight;
            // The total distance over which the parent (heroWrapperRef) scrolls WHILE the sticky content is active.
            // This is the total height of heroWrapperRef minus one screen height (for the sticky part).
            const scrollableParentHeight = heroElement.scrollHeight - viewportHeight;
            
            // How much the top of the heroWrapperRef has scrolled *above* the top of the viewport.
            const heroTopOffsetFromDocument = heroElement.getBoundingClientRect().top + window.scrollY;
            const amountScrolledRelativeToHeroStart = Math.max(0, window.scrollY - heroTopOffsetFromDocument);

            let progress = 0;
            if (scrollableParentHeight > 0) {
                progress = Math.min(1, amountScrolledRelativeToHeroStart / scrollableParentHeight);
            } else if (amountScrolledRelativeToHeroStart > 0) { // If animation height is just 100vh or less
                progress = 1; // Considered fully scrolled for animation purposes
            }
            setScrollProgress(progress);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); 

    return () => {
        window.removeEventListener('scroll', handleScroll);
        cancelAnimationFrame(rafId);
    }
  }, [animationScrollHeightVH]);

  // Main Background
  const mainBgTranslateY = scrollProgress * 8; // vh, slower parallax
  const mainBgScale = 1 + scrollProgress * 0.03; // very subtle zoom

  // Background Object/Icon
  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 12; // vh
  const bgObjectOpacity = Math.max(0.05, 0.8 - scrollProgress * 0.7); 

  // Original Title Text (fades out and scales down, moves behind mask)
  const titleTextInitialScale = 1;
  const titleTextTargetScale = 0.6;
  const titleTextScale = titleTextInitialScale - scrollProgress * (titleTextInitialScale - titleTextTargetScale);
  const titleTextTranslateY = scrollProgress * 25; // vh - moves down
  const titleTextOpacity = Math.max(0, 1 - scrollProgress * 3); // Fades out relatively quickly


  const maskTextContent = textToMask || title;

  return (
    // This is the scrollable container that defines the animation duration
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      {/* This is the STICKY container that holds all animated elements */}
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        
        {/* Layer 1: Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${mainBgScale})`, 
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-black/70 -z-20"></div>

        {/* Layer 2: Large Background Icon/Object */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity,
              transform: `scale(${bgObjectScale}) translateY(${bgObjectTranslateY}vh)`,
              willChange: 'opacity, transform',
            }}
          >
            {/* Using a div with background image for better scaling/positioning as a layer */}
            <div 
              className="w-[60%] md:w-[40%] aspect-square bg-contain bg-no-repeat bg-center opacity-20"
              style={{ backgroundImage: `url(${backgroundImageObjectUrl})`}}
            ></div>
          </div>
        )}
        
        {/* Layer 3: Original Title Text (fades out, stays behind mask) */}
        <div 
          className="relative text-center px-4 z-10" 
          style={{ 
            transform: `scale(${titleTextScale}) translateY(${titleTextTranslateY}vh)`, 
            opacity: titleTextOpacity,
            willChange: 'transform, opacity',
          }}
        >
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6"
              )} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/70 font-mono max-w-3xl mx-auto" style={{ opacity: titleTextOpacity }}>
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        {/* Layer 4: Text Mask Effect - this appears "through" the original title */}
        <TextMaskEffect text={maskTextContent} scrollProgress={scrollProgress} />
        
        {/* Layer 5: Children (e.g., buttons) */}
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-50">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;