"use client";
import React, { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 
import TextMaskEffect from './TextMaskEffect';

interface TextToSVGMaskProps {
  text: string;
  maskId: string;
  textClass?: string;
  fontFamily?: string;
  fontWeight?: string | number;
  // Position and scale of the text within the 0-1 objectBoundingBox space
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  textClass = "text-8xl font-orbitron font-bold", // Default styling for the mask text
  fontFamily = "Orbitron, sans-serif", // Ensure Orbitron is loaded
  fontWeight = "bold",
  x = 0.05, // Start text slightly inset
  y = 0.65, // Baseline for text, adjust based on font. SVG y is baseline.
  width = 0.9, // Use 90% of width
  height = 0.5, // Use 50% of height for text
}) => {
  // Estimate font size relative to viewBox for SVG text
  // This is a rough estimate and might need adjustment
  const estimatedFontSizeForSVG = 0.25 * (height); // e.g. 25% of the allocated height
  
  return (
    <svg className="rockstar-svg-mask-defs">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <svg x={x} y={y - height} width={width} height={height} viewBox={`0 0 ${100 * width / height} 100`} preserveAspectRatio="xMidYMin meet">
            <text 
              x="50%" 
              y="50%" 
              dy="0.35em" // Vertically center-ish based on dominant-baseline
              fill="black" 
              textAnchor="middle" 
              fontFamily={fontFamily}
              fontWeight={fontWeight}
              fontSize={`${estimatedFontSizeForSVG}px`} // Font size in SVG units
              className={textClass} // Apply Tailwind classes if they affect SVG text attributes (some might not)
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
  const uniqueMaskId = useId(); // Generate a unique ID for the mask

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

  const scrollThresholds = {
    initialFadeEnd: 0.15, 
    maskZoomStart: 0.05,
    maskZoomEnd: 0.6,   
    finalTextStart: 0.5, 
    finalTextEnd: 0.85,  
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
  const mainBgScaleProgress = Math.min(1, scrollProgress / scrollThresholds.maskZoomEnd);
  const mainBgScale = mainBgInitialScale - mainBgScaleProgress * (mainBgInitialScale - mainBgTargetScale);
  const mainBgTranslateY = scrollProgress * 5; 

  const bgObjectInitialScale = 0.5;
  const bgObjectTargetScale = 1.1;
  const bgObjectScale = bgObjectInitialScale + scrollProgress * (bgObjectTargetScale - bgObjectInitialScale);
  const bgObjectTranslateY = -scrollProgress * 10; 
  const bgObjectOpacity = Math.max(0.05, 0.6 - scrollProgress * 0.55); 

  // Initial Title Text - STAYS STATIC and gets covered by mask
  // No animation for opacity, scale, or transform for the initial title itself.
  // It will be revealed/hidden by the mask overlay.

  const initialMaskScale = 50; 
  const targetMaskScale = 1;
  let maskProgress = 0;
  if (scrollProgress >= scrollThresholds.maskZoomStart) {
    maskProgress = Math.min(1, (scrollProgress - scrollThresholds.maskZoomStart) / (scrollThresholds.maskZoomEnd - scrollThresholds.maskZoomStart));
  }
  const currentMaskScale = initialMaskScale - (initialMaskScale - targetMaskScale) * Math.pow(maskProgress, 2); // Smoother exponential scaling
  const maskOverlayOpacity = maskProgress > 0 ? 1 : 0; 

  const finalMaskedTextContent = textToMask || title;

  const svgMaskUrl = `url(#${uniqueMaskId})`;

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        
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
        
        {/* Layer 2: Initial Title Text (STATIC, will be covered by mask) */}
        <div 
          className="relative text-center px-4 z-10" 
          // No dynamic style based on scrollProgress here
        >
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

        {/* Layer 3: SVG Masked Overlay */}
        <div
          className="absolute inset-0 z-20" 
          style={{
            backgroundColor: 'hsl(var(--background))', 
            opacity: maskOverlayOpacity,
            transform: `scale(${Math.max(targetMaskScale, currentMaskScale)})`,
            transformOrigin: 'center center', // Default, adjust if logo anchor is different
            willChange: 'transform, opacity',
            mask: svgMaskUrl,
            WebkitMask: svgMaskUrl,
          }}
        />
        
        {logoMaskPathD && logoMaskViewBox ? (
           <svg className="rockstar-svg-mask-defs">
             <defs>
               <mask id={uniqueMaskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                 <rect x="0" y="0" width="1" height="1" fill="white" />
                 {/* Scale and position the provided SVG path within the 0-1 box.
                     This assumes the path needs to be centered and scaled down.
                     Adjust x, y, width, height as needed based on logo aspect ratio.
                 */}
                 <svg viewBox={logoMaskViewBox} x="0.2" y="0.3" width="0.6" height="0.4" preserveAspectRatio="xMidYMid meet">
                    <path d={logoMaskPathD} fill="black" />
                 </svg>
               </mask>
             </defs>
           </svg>
        ) : (
          // Fallback to dynamic text mask if no pathD is provided
          <TextToSVGMask 
            text={title} 
            maskId={uniqueMaskId}
            // Adjust styling/positioning for text mask as needed
            textClass="text-6xl md:text-7xl lg:text-8xl" // Slightly smaller for mask
            fontFamily="Orbitron, sans-serif" 
            fontWeight="bold"
            y={0.6} // Adjust baseline for Orbitron
            height={0.3} // Smaller height allocation for title text mask
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