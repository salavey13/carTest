"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

// Placeholder for logo path data if not provided
const DEFAULT_LOGO_MASK_PATH_D = "M10 10 H 190 V 90 H 10 Z"; // A simple rectangle
const DEFAULT_LOGO_MASK_VIEWBOX = "0 0 200 100";


interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  textToMask?: string; // Text for the final reveal using TextMaskEffect
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  logoMaskPathD?: string; // SVG path data for the logo mask
  logoMaskViewBox?: string; // viewBox for the logoMaskPathD
  children?: React.ReactNode; 
  animationScrollHeightVH?: number; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  textToMask,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Screenshot_2025-05-18-01-29-18-375_org.telegram.messenger-a58d2b7f-775f-482f-ba0c-7735a3ca2335.jpg", 
  backgroundImageObjectUrl, 
  logoMaskPathD = DEFAULT_LOGO_MASK_PATH_D,
  logoMaskViewBox = DEFAULT_LOGO_MASK_VIEWBOX,
  children,
  animationScrollHeightVH = 300, // Increased for more scroll room
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
            const scrollableParentHeight = heroElement.scrollHeight - viewportHeight;
            const heroTopOffsetFromDocument = heroElement.getBoundingClientRect().top + window.scrollY;
            const amountScrolledRelativeToHeroStart = Math.max(0, window.scrollY - heroTopOffsetFromDocument);

            let progress = 0;
            if (scrollableParentHeight > 0) {
                progress = Math.min(1, amountScrolledRelativeToHeroStart / scrollableParentHeight);
            } else if (amountScrolledRelativeToHeroStart > 0) { 
                progress = 1; 
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

  // Animation Parameters (tuned based on common GTA-like effects)
  const scrollThresholds = {
    initialFadeEnd: 0.15, // Initial content fades out by 15%
    maskZoomStart: 0.05,  // Mask starts zooming slightly after initial fade begins
    maskZoomEnd: 0.6,   // Mask zoom completes by 60%
    finalTextStart: 0.5, // Final text starts appearing at 50%
    finalTextEnd: 0.85,   // Final text fully visible by 85%
  };

  // --- Main Background ---
  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  // Scale from 1.5 down to 1 over 0% to 85% (maskZoomEnd adjusted)
  const mainBgScale = mainBgInitialScale - scrollProgress * (mainBgInitialScale - mainBgTargetScale) * (1 / scrollThresholds.maskZoomEnd);
  const mainBgTranslateY = scrollProgress * 5; // vh, subtle parallax


  // --- Background Object/Icon (Optional decorative layer) ---
  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 10; // vh
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 


  // --- Initial Title Text ---
  const titleTextProgress = Math.min(1, scrollProgress / scrollThresholds.initialFadeEnd);
  const titleTextInitialScale = 1;
  const titleTextTargetScale = 0.7;
  const titleTextScale = titleTextInitialScale - titleTextProgress * (titleTextInitialScale - titleTextTargetScale);
  const titleTextTranslateY = titleTextProgress * 30; // vh - moves down
  const titleTextOpacity = Math.max(0, 1 - titleTextProgress * 1.5); // Fades out quickly


  // --- SVG Masked Overlay ---
  const initialMaskScale = 50; // Very large to make the logo cutout appear small
  const targetMaskScale = 1;
  // Exponential scaling for smoother zoom, occurring between maskZoomStart and maskZoomEnd
  let maskProgress = 0;
  if (scrollProgress >= scrollThresholds.maskZoomStart) {
    maskProgress = Math.min(1, (scrollProgress - scrollThresholds.maskZoomStart) / (scrollThresholds.maskZoomEnd - scrollThresholds.maskZoomStart));
  }
  // Using Math.pow for exponential curve, e.g. Math.pow(maskProgress, 3) for cubic
  const currentMaskScale = initialMaskScale - (initialMaskScale - targetMaskScale) * Math.pow(maskProgress, 2);
  const maskOverlayOpacity = maskProgress > 0 ? 1 : 0; // Become visible when zoom starts

  const finalMaskedTextContent = textToMask || title; // Text for TextMaskEffect

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        
        {/* Layer 0: Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
          }}
        />
        
        {/* Optional: Dark overlay on background image if needed */}
        {/* <div className="absolute inset-0 bg-black/30 -z-20"></div> */}

        {/* Layer 1: Large Background Icon/Object (Decorative) */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity,
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
        
        {/* Layer 2: Initial Title Text (fades out) */}
        <div 
          className="relative text-center px-4 z-10" 
          style={{ 
            transform: `scale(${titleTextScale}) translateY(${titleTextTranslateY}vh)`, 
            opacity: titleTextOpacity,
            willChange: 'transform, opacity',
            visibility: titleTextOpacity > 0 ? 'visible' : 'hidden',
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

        {/* Layer 3: SVG Masked Overlay (The "GTA Logo Reveal") */}
        <div
          className="absolute inset-0 z-20" // Above initial title, below final text
          style={{
            backgroundColor: 'hsl(var(--background))', // Color of the overlay that gets masked
            opacity: maskOverlayOpacity,
            transform: `scale(${Math.max(targetMaskScale, currentMaskScale)})`,
            transformOrigin: 'center center', // Adjust as needed e.g. 'center 25%'
            willChange: 'transform, opacity',
            mask: 'url(#rockstarLogoMask)',
            WebkitMask: 'url(#rockstarLogoMask)',
          }}
        />
        <svg className="rockstar-svg-mask-defs">
          <defs>
            <mask id="rockstarLogoMask" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
              {/* Rect fills the mask with white (opaque for the overlay) */}
              <rect x="0" y="0" width="1" height="1" fill="white" />
              {/* Path is filled with black (transparent area in overlay, revealing background) */}
              {/* The path needs to be scaled and positioned relative to its viewBox to appear correctly */}
              {/* For simplicity, this example assumes the path is drawn to fit a 0-1, 0-1 coordinate system */}
              {/* A more robust solution would involve JS to calculate transform for the path based on logo container */}
              <svg viewBox={logoMaskViewBox} x="0.25" y="0.35" width="0.5" height="0.3" preserveAspectRatio="xMidYMid meet">
                 <path d={logoMaskPathD} fill="black" />
              </svg>
            </mask>
          </defs>
        </svg>
        

        {/* Layer 4: Final Revealed Text (TextMaskEffect component) */}
        {/* Pass scrollProgress directly, TextMaskEffect will manage its own timeline */}
        <TextMaskEffect 
            text={finalMaskedTextContent} 
            scrollProgress={scrollProgress} 
            animationStartProgress={scrollThresholds.finalTextStart}
            animationEndProgress={scrollThresholds.finalTextEnd}
        />
        
        {/* Layer 5: Children (e.g., buttons) - appear when final text is somewhat visible */}
        {children && (
            <div 
                className="absolute bottom-[10vh] md:bottom-[15vh] z-50 transition-opacity duration-500"
                style={{ opacity: scrollProgress > scrollThresholds.finalTextStart ? 1 : 0 }}
            >
                {children}
            </div>
        )}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;