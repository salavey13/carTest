"use client";
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import TextMaskEffect from './TextMaskEffect'; // Предполагается, что этот компонент будет создан

interface RockstarHeroSectionProps {
  title: string;
  subtitle?: string; // Сделаем опциональным
  textToMask?: string; // Текст, который будет "маскироваться/раскрываться"
  mainBackgroundImageUrl?: string;
  backgroundImageObjectUrl?: string; // Для большой иконки/объекта на фоне
  foregroundIconName?: string; // Имя иконки из Fa6
  foregroundIconSize?: string; // Tailwind класс для размера иконки
  children?: React.ReactNode; 
  animationScrollHeightVH?: number; 
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  textToMask,
  mainBackgroundImageUrl = "/assets/images/placeholder-hero-bg-dark-city.jpg", 
  backgroundImageObjectUrl, // Оставим опциональным
  foregroundIconName,    
  foregroundIconSize = "text-6xl",
  children,
  animationScrollHeightVH = 300, 
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroWrapperRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    const heroElement = heroWrapperRef.current;
    if (!heroElement) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId); 
      rafId = requestAnimationFrame(() => {
        if (heroElement) { 
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

  // Анимации
  const mainBgTranslateY = scrollProgress * 15; // vh
  const mainBgScale = 1 + scrollProgress * 0.1;

  const bgObjectScale = 1 + scrollProgress * 0.5;
  const bgObjectTranslateY = -scrollProgress * 20; // vh
  const bgObjectOpacity = 1 - scrollProgress * 0.8;

  const titleTextScale = 1 - scrollProgress * 0.3; // Текст немного уменьшается
  const titleTextTranslateY = scrollProgress * 30; // Уезжает вниз
  const titleTextOpacity = 1 - scrollProgress * 1.5; // Быстро исчезает

  const fgIconScale = 1 + scrollProgress * 2.5; 
  const fgIconTranslateY = -scrollProgress * 60; // vh
  const fgIconOpacity = 1 - scrollProgress * 0.5;

  const maskText = textToMask || title; // Текст для маски

  return (
    <div ref={heroWrapperRef} className="relative" style={{ height: `${animationScrollHeightVH}vh` }}>
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        {/* Main Background */}
        <div
          className="absolute inset-0 bg-cover bg-center -z-30"
          style={{ 
            backgroundImage: `url(${mainBackgroundImageUrl})`,
            transform: `translateY(${mainBgTranslateY}vh) scale(${mainBgScale})`, 
            willChange: 'transform',
          }}
        />
        <div className="absolute inset-0 bg-black/75 -z-20"></div> {/* Darker Overlay */}

        {/* Large Background Icon/Object */}
        {backgroundImageObjectUrl && (
          <div
            className="absolute inset-0 flex items-center justify-center -z-10 pointer-events-none"
            style={{
              opacity: bgObjectOpacity,
              transform: `scale(${bgObjectScale}) translateY(${bgObjectTranslateY}vh)`,
              willChange: 'opacity, transform',
            }}
          >
            <img src={backgroundImageObjectUrl} alt="Background Object" className="max-w-[70%] md:max-w-[50%] opacity-30 h-auto object-contain" />
          </div>
        )}
        
        {/* Title Text (initially visible, will be covered/revealed by mask) */}
        <div 
          className="relative text-center px-4 z-10" // z-index 10 to be above revealed bg, but potentially behind mask
          style={{ 
            transform: `scale(${titleTextScale}) translateY(${titleTextTranslateY}vh)`, 
            opacity: titleTextOpacity,
            willChange: 'transform, opacity',
          }}
        >
          <h1 className={cn(
              "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect mb-4 md:mb-6"
              )} data-text={title}>
            <VibeContentRenderer content={title} />
          </h1>
          {subtitle && (
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300/80 font-mono max-w-3xl mx-auto" style={{ opacity: titleTextOpacity }}>
              <VibeContentRenderer content={subtitle} />
            </p>
          )}
        </div>

        {/* Text Mask Effect - this is what creates the "hole" or reveals the text */}
        <TextMaskEffect text={maskText} scrollProgress={scrollProgress} />

        {/* Foreground Icon */}
        {foregroundIconName && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
            style={{ 
              transform: `translate(-50%, -50%) scale(${fgIconScale}) translateY(${fgIconTranslateY}vh)`, 
              opacity: fgIconOpacity,
              willChange: 'transform, opacity',
              zIndex: 30 // Highest visual layer for icon
            }}
          >
            <VibeContentRenderer content={`::${foregroundIconName}::`} className={cn(foregroundIconSize, "text-brand-pink opacity-80")} />
          </div>
        )}
        
        {children && <div className="absolute bottom-[10vh] md:bottom-[15vh] z-20">{children}</div>}
      </div>
    </div>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";
export default RockstarHeroSection;