"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import TextMaskEffect from './TextMaskEffect'; 

interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  textToMask: string; 
  mainBackgroundImageUrl?: string;
  // backgroundImageObjectUrl?: string; // Removed for simplification in this iteration
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
  // backgroundImageObjectUrl, 
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
            const scrollDistanceForAnimation = window.innerHeight * (animationScrollHeightVH / 100);
            const scrolledAmount = Math.max(0, -rect.top); // 얼마나 스크롤되었는지 (뷰포트 상단을 기준으로)
            const progress = Math.min(1, scrolledAmount / scrollDistanceForAnimation);
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

  // Background Animation
  const mainBgTranslateY = scrollProgress * 10; // vh
  const mainBgScale = 1 + scrollProgress * 0.05;

  // Title Text Animation (relatively static, but can have subtle effects)
  const titleTextScale = 1; // Keep title static for mask to reveal it
  const titleTextTranslateY = 0; 
  const titleTextOpacity = 1; 

  // Foreground Icon Animation
  // Starts small/off-screen, zooms in over text, then zooms out/fades
  let fgIconScale = 0.1;
  let fgIconOpacity = 0;
  let fgIconTranslateY = 50; // Start from bottom (vh)

  if (scrollProgress < 0.5) { // First half of scroll: icon zooms in and moves up
    const halfProgress = scrollProgress / 0.5;
    fgIconScale = 0.1 + halfProgress * 2.9; // Scale from 0.1 to 3
    fgIconOpacity = halfProgress;          // Fade in
    fgIconTranslateY = 50 - halfProgress * 70; // Move from 50vh below center to 20vh above center
  } else { // Second half of scroll: icon continues to move up and fades out / scales down
    const halfProgress = (scrollProgress - 0.5) / 0.5;
    fgIconScale = 3 - halfProgress * 2; // Scale from 3 down to 1
    fgIconOpacity = 1 - halfProgress;     // Fade out
    fgIconTranslateY = -20 - halfProgress * 50; // Continue moving up
  }
  
  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${mainBgScale})`, 
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-black/75 -z-20"></div>

        {/* Title Text (acts as the base layer to be revealed) */}
        <div 
          className="relative text-center px-4 z-10" // z-index 10
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
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/80 font-mono max-w-3xl mx-auto" style={{ opacity: titleTextOpacity }}>
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        {/* Text Mask Effect - This "reveals" the title by fading out */}
        <TextMaskEffect text={textToMask} scrollProgress={scrollProgress} baseTitleZIndex={10} />


        {/* Foreground Icon */}
        {foregroundIconName && (
          <div
            className="absolute top-1/2 left-1/2 pointer-events-none" 
            style={{ 
              transform: `translate(-50%, -50%) scale(${fgIconScale}) translateY(${fgIconTranslateY}vh)`, 
              opacity: fgIconOpacity,
              willChange: 'transform, opacity',
              zIndex: 30 
            }}
          >
            <VibeContentRenderer content={`::${foregroundIconName}::`} className={cn(foregroundIconSize, "text-brand-yellow")} />
          </div>
        )}
        
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-20">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;