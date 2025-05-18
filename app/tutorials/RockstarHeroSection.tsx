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
  targetMaskTextHeightVH?: number; // Desired height of the text as % of viewport height
  // These are now relative to the SVG container for the text mask
  svgX?: string; // e.g., "50%"
  svgY?: string; // e.g., "50%"
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  fontFamily = "Orbitron, sans-serif",
  fontWeight = "bold",
  targetMaskTextHeightVH = 15, // Aim for text to be roughly 15vh tall in the mask
  svgX = "50%",
  svgY = "50%",
}) => {
  // The SVG for the mask will itself be scaled by the parent div.
  // We define the text size within this SVG relative to its own viewBox.
  // A common viewBox for text is 0 0 1000 100 (width 1000, height 100 for sizing text)
  // Let's make text occupy a good portion of this viewBox height, e.g. 80 units.
  const svgTextFontSize = 80; // Arbitrary units within the text's own SVG viewBox

  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          {/* This inner SVG is positioned and scaled to fit within the 0-1 objectBoundingBox space.
              Its viewBox defines its internal coordinate system.
              The text is then positioned within this inner SVG.
          */}
          <svg x="0.05" y="0.25" width="0.9" height="0.5" // Example: text area occupies center 90% width, 50% height
               viewBox="0 0 1000 200" // Adjusted viewBox for potentially better text scaling control
               preserveAspectRatio="xMidYMid meet">
            <text 
              x={svgX} 
              y={svgY}
              dominantBaseline="middle" // Better for vertical centering
              textAnchor="middle" 
              fill="black" 
              fontFamily={fontFamily}
              fontWeight={fontWeight}
              fontSize={svgTextFontSize} // Font size in viewBox units
              letterSpacing="0.01em" // Adjust letter spacing if needed
              className="uppercase" // Apply general text styling if desired for mask shape
            >
              {text}
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
            // Total scrollable distance for the animation is the height of the wrapper minus one viewport height
            const scrollableParentHeight = heroElement.scrollHeight - viewportHeight;
            // How much the top of the *sticky container's parent* (heroWrapperRef) has scrolled *above* the top of the viewport.
            // This ensures progress is 0 when the sticky container just starts sticking.
            const heroWrapperRect = heroElement.getBoundingClientRect();
            const amountScrolledRelativeToHeroStart = Math.max(0, -heroWrapperRect.top);

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
    handleScroll(); // Initial calculation

    return () => {
        window.removeEventListener('scroll', handleScroll);
        cancelAnimationFrame(rafId);
    }
  }, [animationScrollHeightVH]);

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
  const mainBgTranslateY = scrollProgress * 2; // Reduced parallax for less movement

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
  const currentMaskScale = initialMaskScale - (initialMaskScale - targetMaskScale) * Math.pow(maskProgress, 1.5); // Adjusted exponent for feel
  const maskOverlayOpacity = maskProgress > 0.01 ? 1 : 0; // Fade in smoothly

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
            transformOrigin: 'center 40%', // Adjusted origin
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
            text={title} // Use the main title for the mask shape
            maskId={uniqueMaskId}
            targetMaskTextHeightVH={20} // Adjust desired height of text in mask
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
                style={{ opacity: scrollProgress > scrollThresholds.finalTextStart + 0.1 ? 1 : 0 }} // Children appear slightly after text starts
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