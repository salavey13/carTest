"use client";
import React, { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

interface TextToSVGMaskProps {
  text: string;
  maskId: string;
  sourceElementSelector?: string; // Selector for the HTML element to match style from
  svgX?: string; 
  svgY?: string; 
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  sourceElementSelector, // e.g., '.gta-vibe-text-effect' specific to the title
  svgX = "50%",
  svgY = "0%", // Using dominant-baseline: hanging, y=0 aligns top of text
}) => {
  const [fontFamily, setFontFamily] = useState("Orbitron, sans-serif");
  const [fontWeight, setFontWeight] = useState<string | number>("bold");
  const [fontSize, setFontSize] = useState("80"); // Default SVG font size units
  const [letterSpacing, setLetterSpacing] = useState("normal");

  useEffect(() => {
    if (sourceElementSelector) {
      const sourceElement = document.querySelector(sourceElementSelector) as HTMLElement;
      if (sourceElement) {
        const computedStyle = window.getComputedStyle(sourceElement);
        setFontFamily(computedStyle.fontFamily);
        setFontWeight(computedStyle.fontWeight);
        setFontSize(computedStyle.fontSize); // Will be like "72px"
        setLetterSpacing(computedStyle.letterSpacing);
      } else {
        // Fallback if source element not found
        console.warn(`[TextToSVGMask] Source element for style matching ("${sourceElementSelector}") not found. Using defaults.`);
      }
    }
  }, [text, sourceElementSelector]); // Re-calculate if text or selector changes
  
  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          {/* ViewBox adjusted to give more relative height for text */}
          <svg x="0.02" y="0.05" width="0.96" height="0.9" 
               viewBox="0 0 1000 300" // Increased height in viewBox for better font scaling
               preserveAspectRatio="xMidYMid meet">
            <text 
              x={svgX} 
              y={svgY} // Y position for hanging text
              dominantBaseline="hanging" // Aligns top of text to Y
              textAnchor="middle" 
              fill="black" 
              fontFamily={fontFamily}
              fontWeight={fontWeight.toString()}
              fontSize={fontSize} // Use computed font size directly
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
  titleClassNameForMask?: string; // Pass the class used by the H1 title for style matching
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
  titleClassNameForMask = "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect",
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
  const titleRef = useRef<HTMLHeadingElement>(null); // Ref for the H1 title
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
        // Scroll progress calculation remains the same, handled by scroll listener when visible
      },
      { 
        threshold: 0, // Trigger as soon as any part is visible/hidden
        rootMargin: "0px" 
      }
    );
    observer.observe(triggerElement);

    const handleScroll = () => {
        // We need to check isVisible state directly, not from a stale closure
        // A ref for isVisible could be used, or check entry.isIntersecting from observer if possible
        // For simplicity, let's assume isVisible state is up-to-date enough for this scroll handler
        // or rely more on IntersectionObserver's entry.intersectionRatio for progress when it fires.
        
        const currentTriggerEl = document.querySelector(triggerElementSelector);
        if(currentTriggerEl){
            const rect = currentTriggerEl.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            // Progress based on the trigger element's journey through the viewport
            // 0 when trigger's top is at viewport bottom, 1 when trigger's bottom is at viewport top
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        }
    };
    
    // Call initially to set progress if trigger is already in view
    handleScroll(); 

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.unobserve(triggerElement);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [triggerElementSelector]); // Removed isVisible from deps to avoid re-binding scroll listener on its change

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

  // Create a unique class or ID for the H1 to be targeted by TextToSVGMask
  const h1TargetClassForMask = `rockstar-title-for-mask-${uniqueMaskId}`;

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden transition-opacity duration-300 ease-in-out"
        style={{
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? 'auto' : 'none',
        }}
    >
        {/* Layer 1: Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
          }}
        />
        
        {/* Layer 2: Decorative Background Object */}
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
        
        {/* Layer 3: Initial Title & Subtitle (Static) */}
        <div className="relative text-center px-4 z-10">
          <h1 ref={titleRef} className={cn(titleClassNameForMask, h1TargetClassForMask, "mb-4 md:mb-6")} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/70 font-mono max-w-3xl mx-auto">
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        {/* Layer 4: Masked Overlay */}
        <div
          className="absolute inset-0 z-20" 
          style={{
            backgroundColor: 'hsl(var(--background))', 
            opacity: maskOverlayOpacity, // Controlled by maskProgress
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
            sourceElementSelector={`.${h1TargetClassForMask}`} // Target the specific H1
          />
        )}
        
        {/* Layer 5: Final Text (TextMaskEffect) */}
        <TextMaskEffect 
            text={finalMaskedTextContent} 
            scrollProgress={scrollProgress} 
            animationStartProgress={scrollThresholds.finalTextStart}
            animationEndProgress={scrollThresholds.finalTextEnd}
        />
        
        {/* Layer 6: Children (Buttons, etc.) */}
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