"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 

interface RockstarHeroSectionProps {
  title: string;
  subtitle: string;
  mainBackgroundImageUrl?: string;
  foregroundImageUrl?: string;    
  revealedBackgroundImageUrl?: string; 
  children?: React.ReactNode; 
  animationScrollHeightVH?: number; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "/assets/images/placeholder-hero-bg-dark-city.jpg", 
  foregroundImageUrl = "/assets/images/placeholder-hero-fg-object.png",     
  revealedBackgroundImageUrl = "/assets/images/placeholder-hero-revealed-bg-abstract.jpg", 
  children,
  animationScrollHeightVH = 300, // Changed to 300vh for a longer scroll effect
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); // Cancel previous frame to avoid multiple updates per scroll event
      rafId = requestAnimationFrame(() => {
        if (heroElement) { // Check heroElement again inside RAF
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

  // Foreground: zooms in significantly, moves up slightly
  const fgScale = 1 + scrollProgress * 1.8; // Adjusted for more noticeable zoom
  const fgTranslateY = -scrollProgress * 40; // Adjusted for less upward movement relative to zoom

  // Text block: scales up a bit, moves up more noticeably than FG to create parallax
  const textScale = 1 + scrollProgress * 0.4; 
  const textTranslateY = -scrollProgress * 120; // Increased upward movement

  // Revealed background: opacity and slight zoom out/in (can be adjusted)
  const revealedBgOpacity = scrollProgress > 0.15 ? Math.min(1, (scrollProgress - 0.15) / 0.7) : 0; // Fade in between 15% and 85% scroll
  const revealedBgScale = 1 + scrollProgress * 0.2; 

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Layer 1: Main Background (fixed or very slow parallax) */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${scrollProgress * 15}vh) scale(1.1)`, // Slight parallax and initial zoom out
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-black/60 -z-20"></div>

        {/* Layer 2: Revealed Background (behind text, animates) */}
        {revealedBackgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center -z-10" // Ensure it's behind text
            style={{
              backgroundImage: `url(${revealedBackgroundImageUrl})`,
              opacity: revealedBgOpacity,
              transform: `scale(${revealedBgScale})`,
              willChange: 'opacity, transform',
            }}
          />
        )}
        
        {/* Layer 3: Text Content (scales and moves, acts as 'window') */}
        <div 
          className="relative text-center px-4 z-0" // z-index default 0
          style={{ 
            transform: `scale(${textScale}) translateY(${textTranslateY}vh)`, // Using vh for translateY for consistency with scroll height
            willChange: 'transform',
          }}
        >
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6"
              )} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200/90 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={subtitle} />
          </p>
        </div>

        {/* Layer 4: Foreground Image (zooms and moves most) */}
        {foregroundImageUrl && (
          <div
            className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none" // Centering container
            style={{ 
              transform: `scale(${fgScale}) translateY(${fgTranslateY}vh)`, // Using vh
              willChange: 'transform',
              zIndex: 5 
            }}
          >
            <img
              src={foregroundImageUrl}
              alt="Hero Foreground"
              className="max-w-[60%] md:max-w-[45%] lg:max-w-[35%] h-auto object-contain" // Adjusted size
            />
          </div>
        )}
        
        {/* Layer 5: Children (e.g., buttons), above everything */}
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-10">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;