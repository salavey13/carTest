"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // Assuming this is for rendering title/subtitle with icons

interface RockstarHeroSectionProps {
  title: string;
  subtitle: string;
  mainBackgroundImageUrl?: string;
  foregroundImageUrl?: string;    // e.g., character silhouette
  revealedBackgroundImageUrl?: string; // e.g., abstract/bright texture for text reveal
  children?: React.ReactNode; // For buttons or other elements inside the hero
  animationScrollHeightVH?: number; // How many viewport heights the animation should span
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "/assets/images/placeholder-hero-bg-dark-city.jpg", // Placeholder
  foregroundImageUrl = "/assets/images/placeholder-hero-fg-object.png",     // Placeholder, should have transparency
  revealedBackgroundImageUrl = "/assets/images/placeholder-hero-revealed-bg-abstract.jpg", // Placeholder
  children,
  animationScrollHeightVH = 150, // Default: animation occurs over 150vh of scroll
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); // Ref for the overall animation container

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    const handleScroll = () => {
      const rect = heroElement.getBoundingClientRect();
      // Calculate how much of the 'animationScrollHeightVH' has been scrolled past
      // rect.top will be 0 when the top of heroWrapperRef is at the top of the viewport
      // It will be negative as it scrolls up.
      const scrollDistanceForAnimation = window.innerHeight * (animationScrollHeightVH / 100);
      const scrolledAmount = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolledAmount / scrollDistanceForAnimation);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [animationScrollHeightVH]);

  // Define transformations based on scrollProgress (0 to 1)
  // Foreground: zooms in significantly, moves up slightly
  const fgScale = 1 + scrollProgress * 2; // Example: scales from 1x to 3x
  const fgTranslateY = -scrollProgress * 50; // Example: moves up by 50% of its own height equivalent over the scroll

  // Text block: scales up a bit, moves up more noticeably than FG to create parallax
  const textScale = 1 + scrollProgress * 0.5; // Example: scales from 1x to 1.5x
  const textTranslateY = -scrollProgress * 100; // Example: moves up by 100% of its own height equivalent

  // Revealed background: opacity and slight zoom out
  const revealedBgOpacity = scrollProgress > 0.2 ? Math.min(1, (scrollProgress - 0.2) / 0.6) : 0; // Fades in between 20% and 80% scroll
  const revealedBgScale = 1 + scrollProgress * 0.3; // Zooms in slightly to fill 'hole'

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Layer 1: Main Background (fixed or very slow parallax) */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            // transform: `translateY(${scrollProgress * 5}vh)` // Subtle parallax
          }}
        />
        <div className="absolute inset-0 bg-black/70 -z-20"></div> {/* Darkening overlay */}

        {/* Layer 2: Revealed Background (behind text, animates) */}
        {revealedBackgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center -z-10"
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
          className="relative text-center px-4" // z-index managed by order, will be behind foreground by default
          style={{ 
            transform: `scale(${textScale}) translateY(${textTranslateY}px)`,
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
            className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
            style={{ 
              transform: `scale(${fgScale}) translateY(${fgTranslateY}px)`,
              willChange: 'transform',
              zIndex: 5 // Ensures it's above the text block (default z-index 0)
            }}
          >
            <img
              src={foregroundImageUrl}
              alt="Hero Foreground"
              className="max-w-[70%] md:max-w-[50%] h-auto object-contain"
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