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
  backgroundImageObjectUrl?: string; 
  foregroundIconName?: string; 
  foregroundIconSize?: string; 
  children?: React.ReactNode; 
  animationScrollHeightVH?: number; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  textToMask,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Screenshot_2025-05-18-01-29-18-375_org.telegram.messenger-a58d2b7f-775f-482f-ba0c-7735a3ca2335.jpg", 
  backgroundImageObjectUrl, 
  foregroundIconName,    
  foregroundIconSize = "text-6xl",
  children,
  animationScrollHeightVH = 300, 
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); // Ref for the outer scrollable container
  const stickyContentRef = useRef<HTMLDivElement>(null); // Ref for the sticky content part

  useEffect(() => {
    const scrollableElement = heroWrapperRef.current;
    if (!scrollableElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); 
      rafId = requestAnimationFrame(() => {
        // Progress is calculated based on how much the heroWrapperRef has scrolled out of view
        // relative to its total scrollable height (animationScrollHeightVH - 100vh for the sticky part)
        const viewportHeight = window.innerHeight;
        const totalScrollableDistance = viewportHeight * (animationScrollHeightVH / 100 - 1); // Exclude the 100vh screen part
        const currentScrollY = window.scrollY;
        const heroTopOffset = scrollableElement.offsetTop; // Get the initial top offset of the wrapper

        // Calculate scrolled amount *within the component's scrollable area*
        const scrolledAmountInComponent = Math.max(0, currentScrollY - heroTopOffset);
        
        let progress = 0;
        if (totalScrollableDistance > 0) {
            progress = Math.min(1, scrolledAmountInComponent / totalScrollableDistance);
        } else if (scrolledAmountInComponent > 0) { // If animation height is just 100vh, progress can be 0 or 1
            progress = 1;
        }
        
        setScrollProgress(progress);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial calculation in case the page loads scrolled
    // Needs a slight delay for elements to be in place, or call after mount.
    requestAnimationFrame(handleScroll); 

    return () => {
        window.removeEventListener('scroll', handleScroll);
        cancelAnimationFrame(rafId);
    }
  }, [animationScrollHeightVH]);

  // Main Background
  const mainBgTranslateY = scrollProgress * 10; // vh
  const mainBgScale = 1 + scrollProgress * 0.1;

  // Background Object/Icon
  const bgObjectInitialScale = 0.7;
  const bgObjectTargetScale = 1.3;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 15; // vh
  const bgObjectOpacity = Math.max(0.1, 1 - scrollProgress * 0.7); // Keep it slightly visible

  // Original Title Text (fades out and scales down slightly, moves behind mask)
  const titleTextInitialScale = 1;
  const titleTextTargetScale = 0.8;
  const titleTextScale = titleTextInitialScale - scrollProgress * (titleTextInitialScale - titleTextTargetScale);
  const titleTextTranslateY = scrollProgress * 15; // vh - moves down slowly
  const titleTextOpacity = Math.max(0, 1 - scrollProgress * 2.5); // Fades out quicker

  // Foreground Icon
  const fgIconInitialScale = 0.2;
  const fgIconTargetScale = 4; 
  const fgIconScale = fgIconInitialScale + scrollProgress * (fgIconTargetScale - fgIconInitialScale); 
  const fgIconTranslateY = -scrollProgress * 80; // vh 
  const fgIconOpacity = Math.max(0, 1 - scrollProgress * 1.0);


  const maskTextContent = textToMask || title;

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div ref={stickyContentRef} className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${mainBgScale})`, 
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-black/70 -z-20"></div>

        {/* Large Background Icon/Object */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity,
              transform: `scale(${bgObjectScale}) translateY(${bgObjectTranslateY}vh)`,
              willChange: 'opacity, transform',
            }}
          >
            <img src={backgroundImageObjectUrl} alt="Background Object" className="max-w-[60%] md:max-w-[40%] opacity-20 h-auto object-contain" />
          </div>
        )}
        
        {/* Original Title Text (fades out, stays behind mask) */}
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

        {/* Text Mask Effect - this appears "through" the original title */}
        <TextMaskEffect text={maskTextContent} scrollProgress={scrollProgress} />

        {/* Foreground Icon */}
        {foregroundIconName && (
          <div
            className="absolute top-1/2 left-1/2 pointer-events-none" 
            style={{ 
              transform: `translate(-50%, -50%) scale(${fgIconScale}) translateY(${fgIconTranslateY}vh)`, 
              opacity: fgIconOpacity,
              willChange: 'transform, opacity',
              zIndex: 40 // Ensure foreground icon is on top of TextMaskEffect (z-20) and original title (z-10)
            }}
          >
            <VibeContentRenderer content={`::${foregroundIconName}::`} className={cn(foregroundIconSize, "text-brand-pink opacity-70")} />
          </div>
        )}
        
        {/* Children (e.g., buttons) */}
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-50">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;