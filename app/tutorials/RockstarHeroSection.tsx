"use client";
import React, { useState, useEffect, useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 

interface TextToSVGMaskProps {
  text: string;
  maskId: string;
  svgX?: string; 
  svgY?: string; 
}

const TextToSVGMask: React.FC<TextToSVGMaskProps> = ({
  text,
  maskId,
  svgX = "50%",
  svgY = "50%", 
}) => {
  const fontFamily = `"Orbitron", sans-serif`; 
  const fontWeight = "bold";
  const fontSize = "100"; 
  const letterSpacing = "0.01em";

  return (
    <svg className="rockstar-svg-mask-defs" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill="white" />
          <svg x="0.02" y="0.05" width="0.96" height="0.9" 
               viewBox="0 0 1000 250" 
               preserveAspectRatio="xMidYMid meet">
            <text 
              x={svgX} 
              y={svgY}
              dominantBaseline="central" 
              textAnchor="middle" 
              fill="black" 
              fontFamily={fontFamily}
              fontWeight={fontWeight}
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
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; 
  logoMaskPathD?: string; 
  logoMaskViewBox?: string; 
  children?: React.ReactNode; 
  triggerElementSelector: string;
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/content/purple-abstract-bg.jpeg", 
  backgroundImageObjectUrl, 
  logoMaskPathD,
  logoMaskViewBox,
  children,
  triggerElementSelector,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const fixedHeroContainerRef = useRef<HTMLDivElement>(null);
  const fadeOverlayRef = useRef<HTMLDivElement>(null); // Ref for the fade overlay
  
  const baseUniqueId = useId(); 
  const sanitizedBaseId = baseUniqueId.replace(/:/g, "-");
  const uniqueMaskId = `mask-${sanitizedBaseId}`;

  useEffect(() => {
    const triggerElement = document.querySelector(triggerElementSelector);
    if (!triggerElement) {
      console.warn(`[RockstarHeroSection] Trigger element "${triggerElementSelector}" not found.`);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
            const rect = entry.boundingClientRect;
            const viewportHeight = window.innerHeight;
            const progress = Math.max(0, Math.min(1, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
            setScrollProgress(progress);
        } else {
            const rect = entry.boundingClientRect;
            if (rect.bottom < 0) setScrollProgress(1); 
            else if (rect.top > window.innerHeight) setScrollProgress(0);
        }
      }, { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(triggerElement);

    return () => {
      if (triggerElement) observer.unobserve(triggerElement); 
    };
  }, [triggerElementSelector]); 

  useEffect(() => {
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
    }
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible, triggerElementSelector]);

  const scrollThresholds = {
    maskZoomStart: 0.05, 
    maskZoomEnd: 0.75,
    fadeOverlayStart: 0.65, // Start fading out hero content when mask zoom is well underway
    fadeOverlayEnd: 0.95,   // Hero content fully faded by this point
  };

  const mainBgInitialScale = 1.5;
  const mainBgTargetScale = 1;
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
  const maskOverlayOpacity = maskProgress > 0.01 ? maskProgress : 0; 

  const svgMaskUrl = `url(#${uniqueMaskId})`;

  // Fade overlay animation for smooth disappearance
  let fadeOverlayProgress = 0;
  if (scrollProgress >= scrollThresholds.fadeOverlayStart) {
    fadeOverlayProgress = Math.min(1, (scrollProgress - scrollThresholds.fadeOverlayStart) / (scrollThresholds.fadeOverlayEnd - scrollThresholds.fadeOverlayStart));
  }
  const heroContentOverallOpacity = 1 - fadeOverlayProgress; // Content fades as overlay appears

  return (
    <div 
        ref={fixedHeroContainerRef} 
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
            // Visibility controlled by parent, this container is always "rendered" but might be off-screen effectively
            opacity: isVisible ? 1 : 0, // Controls fade in/out of the entire fixed section
            pointerEvents: isVisible ? 'auto' : 'none',
            transition: 'opacity 0.3s ease-in-out', // Smooth fade for the whole section
        }}
    >
        {/* Layer 1: Main Background -z-30 */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${Math.max(mainBgTargetScale, mainBgScale)})`, 
            willChange: 'transform',
            opacity: heroContentOverallOpacity, // Fade out with content
          }}
        />
        
        {/* Layer 2: Decorative Background Object -z-10 */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity * heroContentOverallOpacity, // Also fades out
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
        <div className="relative text-center px-4 z-10" style={{ opacity: heroContentOverallOpacity }}>
          <h1 className={cn("text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6")} data-text={title}>
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
            opacity: maskOverlayOpacity * heroContentOverallOpacity, // Also fades out
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
          />
        )}
        
        {/* Gradient Fade Overlay - z-40 (above mask, below children) */}
        <div
          ref={fadeOverlayRef}
          className="absolute inset-0 z-40 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to bottom, transparent 70%, hsl(var(--background)) 100%)`,
            opacity: fadeOverlayProgress, // Animates from 0 to 1
            willChange: 'opacity',
          }}
        />
        
        {/* Layer 6: Children (Buttons, etc.) z-50 */}
        {children && (
            <div 
                className="absolute bottom-[10vh] md:bottom-[15vh] z-50" // Ensure children are above fadeOverlay
                // Visibility of children can be tied to overall hero visibility or a specific progress point
                style={{ opacity: heroContentOverallOpacity > 0.1 ? 1 : 0, transition: 'opacity 0.3s ease-in-out' }} 
            >
                {children}
            </div>
        )}
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;