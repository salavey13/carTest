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
  const [actualFontSize, setActualFontSize] = useState("80px"); // Default SVG font size
  const [actualLetterSpacing, setActualLetterSpacing] = useState("normal");

  useEffect(() => {
    // Create a temporary element to measure text rendered with Tailwind classes
    const tempElement = document.createElement("div");
    tempElement.style.fontFamily = fontFamily;
    tempElement.style.fontWeight = fontWeight.toString();
    // Apply a base Tailwind class that RockstarHeroSection's h1 uses for text size
    // This should ideally match the class used for the visible H1 to get accurate metrics
    tempElement.className = cn("text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold uppercase"); 
    tempElement.style.visibility = "hidden";
    tempElement.style.position = "absolute";
    tempElement.textContent = text.toUpperCase(); // Measure uppercase text
    document.body.appendChild(tempElement);

    const computedStyle = window.getComputedStyle(tempElement);
    const htmlFontSize = parseFloat(computedStyle.fontSize);
    const htmlLetterSpacing = computedStyle.letterSpacing;
    document.body.removeChild(tempElement);

    // Convert HTML font size to an appropriate SVG font size
    // This is an approximation. ViewBox scaling also plays a role.
    // Assuming the inner SVG for text (viewBox="0 0 1000 200") means 200 units height.
    // We want the text to fill a portion of this, e.g. 80% => 160 units.
    // The targetMaskTextHeightVH gives a hint about how large it should be visually on screen.
    // This part is complex because HTML px and SVG units in a viewBox are different.
    // Let's use a simpler approach: scale based on a reference HTML size.
    // If targetMaskTextHeightVH is 15vh, and a 7xl tailwind font is ~10vh, then scale up.
    // This calculation is still tricky. A direct pixel value might be more stable if possible.
    // For now, let's keep it tied to a base size and allow `targetMaskTextHeightVH` to be a qualitative guide.
    // A simpler fixed size for SVG text units might be better:
    setActualFontSize("70"); // Units for viewBox 0 0 1000 200, makes text large
    setActualLetterSpacing(htmlLetterSpacing === "normal" ? "0" : htmlLetterSpacing);

  }, [text, fontFamily, fontWeight, targetMaskTextHeightVH]);
  
  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <svg x="0.05" y="0.1" width="0.9" height="0.8" // Area for text mask within the 0-1 space
               viewBox="0 0 1000 200" // Inner SVG viewBox
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
  animationScrollHeightVH?: number; 
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
  animationScrollHeightVH = 300,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); 
  const stickyContainerRef = useRef<HTMLDivElement>(null);
  const uniqueMaskId = useId(); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    const stickyElement = stickyContainerRef.current;
    if (!heroElement || !stickyElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); 
      rafId = requestAnimationFrame(() => {
        if (heroElement && stickyElement) { 
            const viewportHeight = window.innerHeight;
            const scrollableParentHeight = heroElement.scrollHeight - viewportHeight;
            
            const heroWrapperRect = heroElement.getBoundingClientRect();
            const amountScrolledRelativeToHeroStart = -heroWrapperRect.top; // How much top of wrapper is scrolled above viewport top

            let progress = 0;
            if (scrollableParentHeight > 0) {
                // Normalize scroll position to a 0-1 range
                progress = Math.min(1, Math.max(0, amountScrolledRelativeToHeroStart / scrollableParentHeight));
            } else {
                // If no scrollable height, progress is 0 if not scrolled, 1 if scrolled past
                progress = amountScrolledRelativeToHeroStart > 0 ? 1 : 0;
            }
            setScrollProgress(progress);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
        window.removeEventListener('scroll', handleScroll);
        if (rafId) { // Ensure rafId is defined before cancelling
            cancelAnimationFrame(rafId);
        }
    }
  }, [animationScrollHeightVH]); // animationScrollHeightVH dependency is fine if it dictates wrapper height

  const scrollThresholds = {
    maskZoomStart: 0.05,
    maskZoomEnd: 0.6,   
    finalTextStart: 0.5, 
    finalTextEnd: 0.85,  
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  const mainBgScaleProgress = Math.min(1, scrollProgress / scrollThresholds.maskZoomEnd);
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 2; 

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 5; 
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
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div ref={stickyContainerRef} className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        
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
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;