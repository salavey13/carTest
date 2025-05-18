"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // 0 to 1
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ text, scrollProgress }) => {
  // Mask Text (this is the text that zooms in and becomes visible)
  // It starts very large and transparent, then zooms to normal size and full opacity, then fades/zooms out.
  const revealStart = 0.1;  // Start revealing/zooming in the mask text
  const fullyVisibleStart = 0.3; // Mask text is at its target scale and opacity
  const visibleEnd = 0.7;   // Mask text starts to fade/scale out
  const revealEnd = 0.9;    // Mask text is fully faded/scaled out

  let maskOpacity;
  let maskScale;

  if (scrollProgress < revealStart) {
    maskOpacity = 0;
    maskScale = 3; // Start large and off-screen (or very transparent)
  } else if (scrollProgress < fullyVisibleStart) {
    const progressInRange = (scrollProgress - revealStart) / (fullyVisibleStart - revealStart);
    maskOpacity = progressInRange; // Fade in
    maskScale = 3 - (2 * progressInRange); // Scale from 3 down to 1
  } else if (scrollProgress < visibleEnd) {
    maskOpacity = 1;
    maskScale = 1; // Stay at normal size and full opacity
  } else if (scrollProgress < revealEnd) {
    const progressInRange = (scrollProgress - visibleEnd) / (revealEnd - visibleEnd);
    maskOpacity = 1 - progressInRange; // Fade out
    maskScale = 1 + progressInRange * 0.5; // Scale slightly up as it fades
  } else {
    maskOpacity = 0;
    maskScale = 1.5;
  }
  
  maskOpacity = Math.max(0, Math.min(1, maskOpacity));
  maskScale = Math.max(1, maskScale); // Ensure scale doesn't go below 1 during main visibility


  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" 
      // This div is the "mask" itself, its background should match the page background
      // to hide the original title text. Or, the original title text fades out.
      // The text INSIDE this div is what appears to be revealed.
    >
      <div
        className="text-center px-4"
        style={{
          opacity: maskOpacity,
          transform: `scale(${maskScale})`,
          willChange: 'opacity, transform',
        }}
      >
        <h1
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold",
            // This text uses a different style to differentiate from the original title
            "text-transparent bg-clip-text bg-gradient-to-br from-brand-yellow via-brand-orange to-brand-pink",
            "px-4" // Added padding for safety
          )}
          // Using data-text here allows CSS glitch effect on this text too, if desired
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