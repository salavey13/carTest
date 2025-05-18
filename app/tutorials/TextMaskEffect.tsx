"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // 0 to 1
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ text, scrollProgress }) => {
  // Text starts very large and transparent, then zooms in and becomes opaque
  const initialScale = 10; // Start very large (zoomed in)
  const targetScale = 1;   // End at normal size

  // Opacity: 0 at start, 1 in the middle, 0 at end
  // Let's make it appear from progress 0.1 to 0.5, then stay, then fade from 0.8 to 1.0
  let currentOpacity;
  if (scrollProgress < 0.1) {
    currentOpacity = 0;
  } else if (scrollProgress < 0.5) {
    currentOpacity = (scrollProgress - 0.1) / (0.5 - 0.1); // Fade in
  } else if (scrollProgress < 0.8) {
    currentOpacity = 1; // Stay visible
  } else {
    currentOpacity = 1 - (scrollProgress - 0.8) / (1.0 - 0.8); // Fade out
  }
  currentOpacity = Math.max(0, Math.min(1, currentOpacity));


  // Scale: from initialScale to targetScale as opacity becomes 1, then stays targetScale
  let currentScale;
   if (scrollProgress < 0.1) {
    currentScale = initialScale;
  } else if (scrollProgress < 0.5) {
    // Interpolate scale from initialScale down to targetScale as opacity goes from 0 to 1
    const scaleProgress = (scrollProgress - 0.1) / (0.5 - 0.1);
    currentScale = initialScale - (initialScale - targetScale) * scaleProgress;
  } else {
    currentScale = targetScale; // Stay at target scale
  }
  currentScale = Math.max(targetScale, currentScale);


  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" 
      style={{
        opacity: currentOpacity,
        transform: `scale(${currentScale})`,
        willChange: 'opacity, transform',
      }}
    >
      <h1
        className={cn(
          "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold text-center",
          // Different style for the "revealed" text
          "text-transparent bg-clip-text bg-gradient-to-br from-brand-yellow via-brand-orange to-brand-pink",
          "px-4"
        )}
        data-text={text} // For potential CSS glitch on this text too, if desired
      >
        <VibeContentRenderer content={text} />
      </h1>
    </div>
  );
};

TextMaskEffect.displayName = "TextMaskEffect";
export default TextMaskEffect;