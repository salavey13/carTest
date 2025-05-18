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
            const scrollDistanceForAnimation = window.innerHeight * (animationScrollHeightVH / 100);
            const scrolledAmount = Math.max(0, -rect.top);
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

  // Main Background
  const mainBgTranslateY = scrollProgress * 10; // vh
  const mainBgScale = 1 + scrollProgress * 0.05;

  // Background Object/Icon
  const bgObjectInitialScale = 0.8;
  const bgObjectTargetScale = 1.5;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 25; // vh
  const bgObjectOpacity = Math.max(0, 1 - scrollProgress * 1.2);

  // Original Title Text (fades out and scales down slightly)
  const titleTextInitialScale = 1;
  const titleTextTargetScale = 0.7;
  const titleTextScale = titleTextInitialScale - scrollProgress * (titleTextInitialScale - titleTextTargetScale);
  const titleTextTranslateY = scrollProgress * 40; // vh - moves down and away
  const titleTextOpacity = Math.max(0, 1 - scrollProgress * 2); 

  // Foreground Icon
  const fgIconInitialScale = 0.3;
  const fgIconTargetScale = 3.5; // Make it zoom much larger
  const fgIconScale = fgIconInitialScale + scrollProgress * (fgIconTargetScale - fgIconInitialScale); 
  const fgIconTranslateY = -scrollProgress * 70; // vh - moves up faster
  const fgIconOpacity = Math.max(0, 1 - scrollProgress * 1.1);


  const maskTextContent = textToMask || title;

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
        <div className="absolute inset-0 bg-black/80 -z-20"></div> {/* Darker Overlay */}

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
        
        {/* Original Title Text (fades out) */}
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

        {/* Text Mask Effect - This text appears */}
        <TextMaskEffect text={maskTextContent} scrollProgress={scrollProgress} />

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
            <VibeContentRenderer content={`::${foregroundIconName}::`} className={cn(foregroundIconSize, "text-brand-pink opacity-70")} />
          </div>
        )}
        
        {/* Children (e.g., buttons) */}
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-40">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;