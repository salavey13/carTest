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
  fontSize?: string; // Expecting a string like "72px"
  letterSpacing?: string;
  svgX?: string; 
  svgY?: string; 
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  fontFamily = "Orbitron, sans-serif",
  fontWeight = "bold",
  fontSize = "80px", // Default if not provided
  letterSpacing = "normal",
  svgX = "50%",
  svgY = "0%", 
}) => {
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
  subtitle?: string; 
  textToMask?: string;
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  logoMaskPathD?: string; 
  logoMaskViewBox?: string; 
  children?: React.ReactNode; 
  triggerElementSelector: string;
  // Props for mask text styling, to be determined from H1
  maskTextFontFamily?: string;
  maskTextFontWeight?: string | number;
  maskTextFontSize?: string;
  maskTextLetterSpacing?: string;
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
  
  const baseUniqueId = useId(); 
  const sanitizedBaseId = baseUniqueId.replace(/:/g, "-");
  const uniqueMaskId = `mask-${sanitizedBaseId}`;
  const h1MaskTargetId = `rockstar-title-for-mask-source-${sanitizedBaseId}`;

  // States for H1 computed styles
  const [h1FontFamily, setH1FontFamily] = useState("Orbitron, sans-serif");
  const [h1FontWeight, setH1FontWeight] = useState<string | number>("bold");
  const [h1FontSize, setH1FontSize] = useState("70px"); // Default, will be updated
  const [h1LetterSpacing, setH1LetterSpacing] = useState("normal");

  useEffect(() => {
    const h1Element = document.getElementById(h1MaskTargetId);
    if (h1Element) {
      const computedStyle = window.getComputedStyle(h1Element);
      setH1FontFamily(computedStyle.fontFamily);
      setH1FontWeight(computedStyle.fontWeight);
      setH1FontSize(computedStyle.fontSize);
      setH1LetterSpacing(computedStyle.letterSpacing);
    }
  }, [title, h1MaskTargetId]); // Re-run if title changes, as it might affect H1 content/rendering

  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      }, { threshold: 0, rootMargin: "0px" }
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
    
    if (isVisible) { 
        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); 
    } else {
        window.removeEventListener('scroll', handleScroll);
        const currentTriggerEl = document.querySelector(triggerElementSelector);
         if(currentTriggerEl){
            const rect = currentTriggerEl.getBoundingClientRect();
            if (rect.bottom < 0) setScrollProgress(1); 
            else if (rect.top > window.innerHeight) setScrollProgress(0);
         } else {
            setScrollProgress(0); 
         }
    }

    return () => {
      if (triggerElement) observer.unobserve(triggerElement); 
      window.removeEventListener('scroll', handleScroll);
    };
  }, [triggerElementSelector, isVisible]); 

  const scrollThresholds = {
    maskZoomStart: 0.05, 
    maskZoomEnd: 0.65,   
    finalTextStart: 0.6, 
    finalTextEnd: 0.9,  
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  // Ensure mainBgScaleProgress doesn't run calculation if scrollProgress is less than maskZoomStart to avoid premature scaling
  let mainBgScaleProgress = 0;
  if (scrollProgress >= scrollThresholds.maskZoomStart) {
    mainBgScaleProgress = Math.min(1, (scrollProgress - scrollThresholds.maskZoomStart) / (scrollThresholds.maskZoomEnd - scrollThresholds.maskZoomStart));
  }
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
  const maskOverlayOpacity = maskProgress > 0.01 ? maskProgress : 0; // Fade in based on maskProgress

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
        {/* Layer 1: Main Background -z-30 */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
          }}
        />
        
        {/* Layer 2: Decorative Background Object -z-10 */}
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
        
        {/* Layer 3: Initial Title & Subtitle (Static) z-10 */}
        <div className="relative text-center px-4 z-10">
          <h1 id={h1MaskTargetId} className={cn("text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6")} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/70 font-mono max-w-3xl mx-auto">
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        {/* Layer 4: Masked Overlay z-20 */}
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
            fontFamily={h1FontFamily}
            fontWeight={h1FontWeight}
            fontSize={h1FontSize}
            letterSpacing={h1LetterSpacing}
          />
        )}
        
        {/* Layer 5: Final Text (TextMaskEffect) z-30 */}
        <TextMaskEffect 
            text={finalMaskedTextContent} 
            scrollProgress={scrollProgress} 
            animationStartProgress={scrollThresholds.finalTextStart}
            animationEndProgress={scrollThresholds.finalTextEnd}
        />
        
        {/* Layer 6: Children (Buttons, etc.) z-50 */}
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