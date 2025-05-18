"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // Overall scroll progress from parent (0 to 1)
  animationStartProgress?: number; // When this component's animation should start (0 to 1)
  animationEndProgress?: number;   // When this component's animation should end (0 to 1)
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ 
  text, 
  scrollProgress,
  animationStartProgress = 0.5, // Default: start at 50% of parent's scroll
  animationEndProgress = 0.85    // Default: end at 85% of parent's scroll
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
    
    currentOpacity = inRangeProgress; // Fade in
    currentScale = initialScale - (initialScale - targetScale) * inRangeProgress; // Scale from initial down to target
  } else { // scrollProgress >= animationEndProgress
    currentOpacity = 1;
    currentScale = targetScale; // Stay at normal size and full opacity
  }
  
  currentOpacity = Math.max(0, Math.min(1, currentOpacity));
  currentScale = Math.max(targetScale, currentScale); 

  // Dynamic gradient for text (as per video concept)
  // Gradient moves from bottom to top
  const gradientStopTop = 100 - (inRangeProgress * 100); // Moves from 100 down to 0
  const gradientStopBottom = gradientStopTop + 100; // Maintain 100% spread for gradient
  
  const dynamicGradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(
      to bottom, 
      hsl(var(--brand-pink) / ${0.3 + currentOpacity * 0.7}) ${gradientStopTop}%, 
      hsl(var(--brand-yellow) / ${0.8 + currentOpacity * 0.2}) ${gradientStopBottom}%
    )`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    textShadow: `0 2px 10px hsla(var(--brand-yellow-rgb), ${currentOpacity * 0.3})`,
  };


  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none" 
      // z-30 to be above SVG mask overlay (z-20)
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
            "px-4" // Ensure padding if text is long
          )}
          style={dynamicGradientStyle}
          data-text={text} // For potential pseudo-element effects if needed
        >
          <VibeContentRenderer content={text} />
        </h1>
      </div>
    </div>
  );
};

TextMaskEffect.displayName = "TextMaskEffect";
export default TextMaskEffect;