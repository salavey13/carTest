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
  const heroWrapperRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); 
      rafId = requestAnimationFrame(() => {
        if (heroElement) { 
            const rect = heroElement.getBoundingClientRect();
            // Progress is based on how much the top of the element has moved past the top of the viewport
            // The total scroll distance for the animation is animationScrollHeightVH (e.g., 300vh) minus 100vh (the screen height it occupies when sticky)
            // However, a simpler approach for progress within the sticky element itself while the PARENT scrolls:
            // rect.top will be negative as the parent scrolls up.
            // When rect.top is 0, progress is 0.
            // When rect.top is -(animationScrollHeightVH - 100) * vh_unit, progress is 1.
            
            const viewportHeight = window.innerHeight;
            // This is the height over which the parent element scrolls while the sticky part is visible
            const scrollDistanceForAnimation = viewportHeight * (animationScrollHeightVH / 100 - 1);
            
            // How much the top of the _parent_ (heroWrapperRef) has scrolled *above* the viewport top.
            // This needs to be relative to when the sticky behavior starts affecting the animation.
            // A simpler way: just use -rect.top normalized by the scrollable height.
            const scrolledAmount = Math.max(0, -rect.top);

            let progress = 0;
            if (scrollDistanceForAnimation > 0) {
                progress = Math.min(1, scrolledAmount / scrollDistanceForAnimation);
            } else if (animationScrollHeightVH === 100 && scrolledAmount > 0) { 
                // If only 100vh, it's either 0 or 1 (fully scrolled past)
                // This case might need refinement if animation is desired even for 100vh height.
                // For simplicity, let's assume animation mainly happens when scrollHeight > 100vh.
                progress = (rect.bottom <= viewportHeight * 0.1) ? 1 : 0; // Quick check if mostly out of view
            }
            
            setScrollProgress(progress);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
        window.removeEventListener('scroll', handleScroll);
        cancelAnimationFrame(rafId);
    }
  }, [animationScrollHeightVH]);

  // Main Background
  const mainBgTranslateY = scrollProgress * 5; // vh, slower parallax
  const mainBgScale = 1 + scrollProgress * 0.02; // very subtle zoom

  // Background Object/Icon
  const bgObjectInitialScale = 0.6;
  const bgObjectTargetScale = 1.2;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 10; // vh
  const bgObjectOpacity = Math.max(0.05, 1 - scrollProgress * 0.9); // Fades but stays slightly visible

  // Original Title Text (fades out and scales down, moves behind mask)
  const titleTextInitialScale = 1;
  const titleTextTargetScale = 0.7;
  const titleTextScale = titleTextInitialScale - scrollProgress * (titleTextInitialScale - titleTextTargetScale);
  const titleTextTranslateY = scrollProgress * 20; // vh - moves down slowly
  const titleTextOpacity = Math.max(0, 1 - scrollProgress * 2.0); // Fades out as mask appears

  // Foreground Icon
  const fgIconInitialScale = 0.2;
  const fgIconTargetScale = 3.0; 
  const fgIconScale = fgIconInitialScale + scrollProgress * (fgIconTargetScale - fgIconInitialScale); 
  const fgIconTranslateY = -scrollProgress * 70; // vh 
  const fgIconOpacity = Math.max(0, 1 - scrollProgress * 0.8); // Fades out slowly after initial appearance


  const maskTextContent = textToMask || title;

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
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
        <div className="absolute inset-0 bg-black/75 -z-20"></div>

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
            <img src={backgroundImageObjectUrl} alt="Background Object" className="max-w-[60%] md:max-w-[40%] opacity-20 h-auto object-contain" />
          </div>
        )}
        
        {/* Layer 3: Original Title Text (fades out, stays behind mask) */}
        <div 
          className="relative text-center px-4 z-10" // z-10
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

        {/* Layer 5: Foreground Icon */}
        {foregroundIconName && (
          <div
            className="absolute top-1/2 left-1/2 pointer-events-none" 
            style={{ 
              transform: `translate(-50%, -50%) scale(${fgIconScale}) translateY(${fgIconTranslateY}vh)`, 
              opacity: fgIconOpacity,
              willChange: 'transform, opacity',
              zIndex: 40 
            }}
          >
            <VibeContentRenderer content={`::${foregroundIconName}::`} className={cn(foregroundIconSize, "text-brand-pink opacity-70")} />
          </div>
        )}
        
        {/* Layer 6: Children (e.g., buttons) */}
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-50">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;