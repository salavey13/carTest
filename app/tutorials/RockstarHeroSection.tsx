"use client";
import React, { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

interface TextToSVGMaskProps {
  text: string;
  maskId: string;
  sourceElementId?: string; // Changed from selector to ID
  svgX?: string; 
  svgY?: string; 
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  sourceElementId, 
  svgX = "50%",
  svgY = "0%", 
}) => {
  const [fontFamily, setFontFamily] = useState("Orbitron, sans-serif");
  const [fontWeight, setFontWeight] = useState<string | number>("bold");
  const [fontSize, setFontSize] = useState("80"); 
  const [letterSpacing, setLetterSpacing] = useState("normal");

  useEffect(() => {
    if (sourceElementId) {
      const sourceElement = document.getElementById(sourceElementId) as HTMLElement;
      if (sourceElement) {
        const computedStyle = window.getComputedStyle(sourceElement);
        setFontFamily(computedStyle.fontFamily);
        setFontWeight(computedStyle.fontWeight);
        setFontSize(computedStyle.fontSize); 
        setLetterSpacing(computedStyle.letterSpacing);
      } else {
        console.warn(`[TextToSVGMask] Source element with ID "${sourceElementId}" not found. Using defaults.`);
      }
    }
  }, [text, sourceElementId]); 
  
  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <svg x="0.02" y="0.05" width="0.96" height="0.9" 
               viewBox="0 0 1000 300" 
               preserveAspectRatio="xMidYMid meet">
            <text 
              x={svgX} 
              y={svgY}
              dominantBaseline="hanging" 
              textAnchor="middle" 
              fill="black" 
              fontFamily={fontFamily}
              fontWeight={fontWeight.toString()}
              fontSize={fontSize} 
              letterSpacing={letterSpacing}
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
  // titleClassNameForMask prop is no longer needed as we use ID
  subtitle?: string; 
  textToMask?: string;
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  logoMaskPathD?: string; 
  logoMaskViewBox?: string; 
  children?: React.ReactNode; 
  triggerElementSelector: string; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  // titleClassNameForMask, // Removed
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
  // const titleRef = useRef<HTMLHeadingElement>(null); // titleRef can be removed if not used elsewhere
  const baseUniqueId = useId(); 
  // Sanitize the ID for use in CSS selectors by replacing colons
  const sanitizedBaseId = baseUniqueId.replace(/:/g, "-");
  const uniqueMaskId = `mask-${sanitizedBaseId}`;
  const h1TargetIdForMask = `rockstar-title-for-mask-${sanitizedBaseId}`;


  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { 
        threshold: 0, 
        rootMargin: "0px" 
      }
    );
    observer.observe(triggerElement);

    const handleScroll = () => {
        const currentTriggerEl = document.querySelector(triggerElementSelector);
        if(currentTriggerEl){
            const rect = currentTriggerEl.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        }
    };
    
    if (isVisible) { // Only add scroll listener if visible to potentially save performance
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial calculation when it becomes visible
    } else {
        window.removeEventListener('scroll', handleScroll);
        // When not visible, set progress based on position relative to viewport
        const currentTriggerEl = document.querySelector(triggerElementSelector);
         if(currentTriggerEl){
            const rect = currentTriggerEl.getBoundingClientRect();
            if (rect.bottom < 0) setScrollProgress(1); // Fully scrolled past
            else if (rect.top > window.innerHeight) setScrollProgress(0); // Not yet scrolled to
         } else {
            setScrollProgress(0); // Default if trigger somehow disappears
         }
    }

    return () => {
      if (triggerElement) observer.unobserve(triggerElement); // Check if triggerElement exists before unobserving
      window.removeEventListener('scroll', handleScroll);
    };
  }, [triggerElementSelector, isVisible]); 

  const scrollThresholds = {
    maskZoomStart: 0.1, 
    maskZoomEnd: 0.7,   
    finalTextStart: 0.55, 
    finalTextEnd: 0.9,  
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  const mainBgScaleProgress = Math.min(1, scrollProgress / scrollThresholds.maskZoomEnd);
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 1; 

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
  const currentMaskScale = initialMaskScale - (initialMaskScale - targetMaskScale) * Math.pow(maskProgress, 1.5); 
  const maskOverlayOpacity = maskProgress > 0.01 ? 1 : 0; 

  const finalMaskedTextContent = textToMask || title;
  const svgMaskUrl = `url(#${uniqueMaskId})`;

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden transition-opacity duration-300 ease-in-out"
        style={{
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none',
        }}
    >
        <div
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
          <h1 id={h1TargetIdForMask} className={cn("text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6")} data-text={title}>
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
            transformOrigin: 'center center', 
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
            sourceElementId={h1TargetIdForMask} 
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