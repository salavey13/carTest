"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // 0 to 1
  baseTitleZIndex?: number; // To position mask correctly relative to the base title
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ text, scrollProgress, baseTitleZIndex = 10 }) => {
  // Mask starts fully opaque and large, then shrinks and fades to reveal text underneath.
  // Animation occurs, for example, between 10% and 70% of the total hero scroll.
  const animationStart = 0.1; // When the mask starts to change
  const animationEnd = 0.7;   // When the mask has fully "disappeared"

  let currentOpacity = 1;
  let currentScale = 3; // Start large, e.g., 300%

  if (scrollProgress < animationStart) {
    currentOpacity = 1;
    currentScale = 3;
  } else if (scrollProgress > animationEnd) {
    currentOpacity = 0;
    currentScale = 0.5; // Shrink down significantly
  } else {
    // Normalize progress within the animation phase (0 to 1)
    const phaseProgress = (scrollProgress - animationStart) / (animationEnd - animationStart);
    currentOpacity = 1 - phaseProgress;      // Fades from 1 to 0
    currentScale = 3 - (phaseProgress * 2.5); // Scales from 3 down to 0.5
  }
  
  // This element acts as the mask. It contains the same text but will be animated.
  // It is positioned above the static title.
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        zIndex: baseTitleZIndex + 5, // Ensure it's above the base title but below the foreground icon
        opacity: currentOpacity,
        transform: `scale(${currentScale})`,
        willChange: 'opacity, transform',
        // This background ensures it covers the text beneath it before fading/shrinking.
        // Should match the page's main background for seamless effect.
        // backgroundColor: 'hsl(var(--background))', // Or a specific masking color
      }}
    >
      <div className="text-center px-4">
        {/* The text content of the mask. Styling can be identical to the main title,
            or it can be a solid color block if the effect is purely about covering/uncovering.
            For now, let's assume it's styled like the title and has the same data-text attribute. */}
        <h1
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect",
            // "text-background" // If we want the mask text to be background-colored to "erase"
            // Or a different color if the mask is a visual element itself.
            // For a simple reveal, this styling might not even matter if opacity is 0 initially.
            // Let's give it a slightly different, more solid appearance for testing the mask.
            "text-transparent bg-clip-text bg-gradient-to-br from-brand-pink to-brand-purple"
          )}
          data-text={text} // Important for ::before/::after glitch effects if .gta-vibe-text-effect uses it
        >
          <VibeContentRenderer content={text} />
        </h1>
      </div>
    </div>
  );
};

TextMaskEffect.displayName = "TextMaskEffect";
export default TextMaskEffect;