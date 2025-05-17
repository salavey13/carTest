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
  animationScrollHeightVH = 150, 
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    const handleScroll = () => {
      const rect = heroElement.getBoundingClientRect();
      const scrollDistanceForAnimation = window.innerHeight * (animationScrollHeightVH / 100);
      const scrolledAmount = Math.max(0, -rect.top);
      const progress = Math.min(1, scrolledAmount / scrollDistanceForAnimation);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); 

    return () => window.removeEventListener('scroll', handleScroll);
  }, [animationScrollHeightVH]);

  const fgScale = 1 + scrollProgress * 2; 
  const fgTranslateY = -scrollProgress * 50; 

  const textScale = 1 + scrollProgress * 0.5; 
  const textTranslateY = -scrollProgress * 100; 

  const revealedBgOpacity = scrollProgress > 0.2 ? Math.min(1, (scrollProgress - 0.2) / 0.6) : 0; 
  const revealedBgScale = 1 + scrollProgress * 0.3; 

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
          }}
        />
        <div className="absolute inset-0 bg-black/70 -z-20"></div>

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
        
        <div 
          className="relative text-center px-4" 
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

        {foregroundImageUrl && (
          <div
            className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
            style={{ 
              transform: `scale(${fgScale}) translateY(${fgTranslateY}px)`,
              willChange: 'transform',
              zIndex: 5 
            }}
          >
            <img
              src={foregroundImageUrl}
              alt="Hero Foreground"
              className="max-w-[70%] md:max-w-[50%] h-auto object-contain"
            />
          </div>
        )}
        
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-10">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;