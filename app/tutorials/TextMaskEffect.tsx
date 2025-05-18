"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // 0 to 1
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ text, scrollProgress }) => {
  const initialScale = 10; 
  const targetScale = 1;   

  // Animation phases based on scrollProgress
  const fadeInStart = 0.1;
  const fadeInEnd = 0.4; // Text fully opaque and at target scale
  const holdStart = fadeInEnd;
  const holdEnd = 0.7;   // Text stays fully visible
  const fadeOutStart = holdEnd;
  const fadeOutEnd = 0.95; // Text fully faded out

  let currentOpacity = 0;
  let currentScale = initialScale;

  if (scrollProgress < fadeInStart) {
    currentOpacity = 0;
    currentScale = initialScale;
  } else if (scrollProgress < fadeInEnd) {
    const progressInRange = (scrollProgress - fadeInStart) / (fadeInEnd - fadeInStart);
    currentOpacity = progressInRange;
    currentScale = initialScale - (initialScale - targetScale) * progressInRange;
  } else if (scrollProgress < holdEnd) {
    currentOpacity = 1;
    currentScale = targetScale;
  } else if (scrollProgress < fadeOutEnd) {
    const progressInRange = (scrollProgress - holdEnd) / (fadeOutEnd - holdEnd);
    currentOpacity = 1 - progressInRange;
    // Optionally, make it scale up a bit as it fades out
    currentScale = targetScale + progressInRange * 0.5; 
  } else {
    currentOpacity = 0;
    currentScale = targetScale + 0.5; // Keep it slightly larger after fade
  }
  
  currentOpacity = Math.max(0, Math.min(1, currentOpacity));
  currentScale = Math.max(targetScale * 0.8, currentScale); // Don't let it get smaller than 80% of target if scaling out

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" 
      // z-20 to be above original title (z-10) but below foreground icon (z-40)
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
            "text-transparent bg-clip-text bg-gradient-to-br from-brand-yellow via-brand-orange to-brand-pink",
            "px-4" 
          )}
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