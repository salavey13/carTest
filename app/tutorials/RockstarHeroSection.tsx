"use client";
import React, { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

interface TextToSVGMaskProps {
  text: string;
  maskId: string;
  fontFamily?: string;
  fontWeight?: string | number;
  targetMaskTextHeightVH?: number; 
  svgX?: string; 
  svgY?: string; 
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  fontFamily = "Orbitron, sans-serif",
  fontWeight = "bold",
  targetMaskTextHeightVH = 15, 
  svgX = "50%",
  svgY = "50%",
}) => {
  const [actualFontSize, setActualFontSize] = useState("80px"); 
  const [actualLetterSpacing, setActualLetterSpacing] = useState("normal");

  useEffect(() => {
    const tempElement = document.createElement("div");
    tempElement.style.fontFamily = fontFamily;
    tempElement.style.fontWeight = fontWeight.toString();
    tempElement.className = cn("text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold uppercase"); 
    tempElement.style.visibility = "hidden";
    tempElement.style.position = "absolute";
    tempElement.textContent = text.toUpperCase(); 
    document.body.appendChild(tempElement);

    const computedStyle = window.getComputedStyle(tempElement);
    const htmlLetterSpacing = computedStyle.letterSpacing;
    document.body.removeChild(tempElement);

    setActualFontSize("70"); 
    setActualLetterSpacing(htmlLetterSpacing === "normal" ? "0" : htmlLetterSpacing);

  }, [text, fontFamily, fontWeight, targetMaskTextHeightVH]);
  
  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <svg x="0.05" y="0.1" width="0.9" height="0.8" 
               viewBox="0 0 1000 200" 
               preserveAspectRatio="xMidYMid meet">
            <text 
              x={svgX} 
              y={svgY}
              dominantBaseline="central" 
              textAnchor="middle" 
              fill="black" 
              fontFamily={fontFamily}
              fontWeight={fontWeight}
              fontSize={actualFontSize} 
              letterSpacing={actualLetterSpacing}
              className="uppercase"
            >
              {text.toUpperCase()}
            </text>
          </svg>
        </mask>
      </defs>
    </svg>
  );
};


interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; 
  textToMask?: string;
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  logoMaskPathD?: string; 
  logoMaskViewBox?: string; 
  children?: React.ReactNode; 
  triggerElementSelector: string; // CSS selector for the trigger element
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  textToMask,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Screenshot_2025-05-18-01-29-18-375_org.telegram.messenger-a58d2b7f-775f-482f-ba0c-7735a3ca2335.jpg", 
  backgroundImageObjectUrl, 
  logoMaskPathD,
  logoMaskViewBox,
  children,
  triggerElementSelector,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const fixedHeroContainerRef = useRef<HTMLDivElement>(null);
  const uniqueMaskId = useId(); 

  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        // Calculate scroll progress based on how much of the trigger element is visible
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          const viewportHeight = window.innerHeight;
          // Progress: 0 when top of trigger is at bottom of viewport
          // Progress: 1 when bottom of trigger is at top of viewport
          // This range covers the full visibility of the trigger element
          const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
          setScrollProgress(progress);
        } else {
          // If not intersecting, decide if progress should be 0 or 1 based on position
          const rect = entry.boundingClientRect;
          if (rect.bottom < 0) { // Trigger is above viewport
            setScrollProgress(1);
          } else if (rect.top > window.innerHeight) { // Trigger is below viewport
            setScrollProgress(0);
          }
        }
      },
      { 
        threshold: Array.from({ length: 101 }, (_, i) => i / 100), // Observe every 1% change
        rootMargin: "0px" // Consider full viewport for intersection
      }
    );

    observer.observe(triggerElement);

    // Add a scroll listener to update progress when the trigger element is visible
    // This is for finer-grained updates than IntersectionObserver alone might provide
    // for the scrollProgress calculation within the visible range.
    const handleScroll = () => {
        if (isVisible) { // Only update if the section is generally visible
            const currentTriggerEl = document.querySelector(triggerElementSelector);
            if(currentTriggerEl){
                const rect = currentTriggerEl.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
                setScrollProgress(progress);
            }
        }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.unobserve(triggerElement);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [triggerElementSelector, isVisible]); // Re-run if selector changes or isVisible state changes (for re-eval on scroll)

  const scrollThresholds = {
    maskZoomStart: 0.1, // Start mask zoom a bit later in trigger's visibility
    maskZoomEnd: 0.7,   // End mask zoom when trigger is mostly through
    finalTextStart: 0.55, 
    finalTextEnd: 0.9,  
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  const mainBgScaleProgress = Math.min(1, scrollProgress / scrollThresholds.maskZoomEnd);
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 1; // Very subtle parallax

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 3; 
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 

  const initialMaskScale = 50; 
  const targetMaskScale = 1;
  let maskProgress = 0;
  if (scrollProgress >= scrollThresholds.maskZoomStart) {
    maskProgress = Math.min(1, (scrollProgress - scrollThresholds.maskZoomStart) / (scrollThresholds.maskZoomEnd - scrollThresholds.maskZoomStart));
  }
  const currentMaskScale = initialMaskScale - (initialMaskScale - targetMaskScale) * Math.pow(maskProgress, 1.8); 
  const maskOverlayOpacity = maskProgress > 0.01 ? 1 : 0; 

  const finalMaskedTextContent = textToMask || title;
  const svgMaskUrl = `url(#${uniqueMaskId})`;

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-in-out"
        style={{
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none',
        }}
    >
        <div // This inner div is for layering, not for scroll mechanics
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
          }}
        />
        
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
        
        <div className="relative text-center px-4 z-10">
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6"
              )} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/70 font-mono max-w-3xl mx-auto">
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        <div
          className="absolute inset-0 z-20" 
          style={{
            backgroundColor: 'hsl(var(--background))', 
            opacity: maskOverlayOpacity,
            transform: `scale(${Math.max(targetMaskScale, currentMaskScale)})`,
            transformOrigin: 'center 35%', 
            willChange: 'transform, opacity',
            mask: svgMaskUrl,
            WebkitMask: svgMaskUrl,
          }}
        />
        
        {logoMaskPathD && logoMaskViewBox ? (
           <svg className="rockstar-svg-mask-defs" aria-hidden="true">
             <defs>
               <mask id={uniqueMaskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                 <rect x="0" y="0" width="1" height="1" fill="white" />
                 <svg viewBox={logoMaskViewBox} x="0.1" y="0.1" width="0.8" height="0.8" preserveAspectRatio="xMidYMid meet">
                    <path d={logoMaskPathD} fill="black" />
                 </svg>
               </mask>
             </defs>
           </svg>
        ) : (
          <TextToSVGMask 
            text={title} 
            maskId={uniqueMaskId}
            targetMaskTextHeightVH={20}
          />
        )}
        
        <TextMaskEffect 
            text={finalMaskedTextContent} 
            scrollProgress={scrollProgress} 
            animationStartProgress={scrollThresholds.finalTextStart}
            animationEndProgress={scrollThresholds.finalTextEnd}
        />
        
        {children && (
            <div 
                className="absolute bottom-[10vh] md:bottom-[15vh] z-50 transition-opacity duration-500"
                style={{ opacity: scrollProgress > scrollThresholds.finalTextStart + 0.1 ? 1 : 0 }} 
            >
                {children}
            </div>
        )}
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;