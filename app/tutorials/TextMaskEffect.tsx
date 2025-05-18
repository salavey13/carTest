"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; 
  animationStartProgress?: number; 
  animationEndProgress?: number;   
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ 
  text, 
  scrollProgress,
  animationStartProgress = 0.5, 
  animationEndProgress = 0.85    
}) => {
  
  const initialScale = 1.25; 
  const targetScale = 1;   

  let currentOpacity = 0;
  let currentScale = initialScale;
  let inRangeProgress = 0;

  if (scrollProgress <= animationStartProgress) {
    currentOpacity = 0;
    currentScale = initialScale;
  } else if (scrollProgress < animationEndProgress) {
    const duration = animationEndProgress - animationStartProgress;
    inRangeProgress = duration > 0 ? (scrollProgress - animationStartProgress) / duration : 1;
    
    currentOpacity = inRangeProgress; 
    currentScale = initialScale - (initialScale - targetScale) * inRangeProgress; 
  } else { 
    currentOpacity = 1;
    currentScale = targetScale; 
  }
  
  currentOpacity = Math.max(0, Math.min(1, currentOpacity));
  currentScale = Math.max(targetScale, currentScale); 

  // Dynamic gradient for text
  // The gradient reveals from bottom to top as inRangeProgress goes from 0 to 1
  const gradientTopPosition = 100 - (inRangeProgress * 100); // from 100% (all transparent) to 0% (all color1)
  const gradientBottomPosition = gradientTopPosition + 100; // Maintain a 100% spread
  
  const dynamicGradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to top, 
      hsl(var(--brand-yellow)) ${gradientTopPosition}%, 
      hsl(var(--brand-pink)) ${gradientBottomPosition}%
    )`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    // Add a subtle text shadow that fades in with opacity
    textShadow: `0 1px 3px hsla(var(--brand-orange-rgb), ${currentOpacity * 0.3}), 0 2px 8px hsla(var(--brand-yellow-rgb), ${currentOpacity * 0.2})`,
  };


  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none" 
    >
      <div
        className="text-center px-4"
        style={{
          opacity: currentOpacity,
          transform: `scale(${currentScale})`,
          willChange: 'opacity, transform',
        }}
      >
        <h1
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold",
            "px-4" 
          )}
          style={dynamicGradientStyle}
          data-text={text} 
        >
          <VibeContentRenderer content={text} />
        </h1>
      </div>
    </div>
  );
};

TextMaskEffect.displayName = "TextMaskEffect";
export default TextMaskEffect;