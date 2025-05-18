"use client";
import React from 'react';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

interface TextMaskEffectProps {
  text: string;
  scrollProgress: number; // 0 to 1
}

const TextMaskEffect: React.FC<TextMaskEffectProps> = ({ text, scrollProgress }) => {
  // Start revealing text after a certain scroll, and fully revealed by another point
  // Example: Start reveal at 20% scroll, fully revealed by 80% scroll
  const revealStart = 0.2;
  const revealEnd = 0.8;

  const maskOpacity = scrollProgress < revealStart 
    ? 1 // Fully opaque (covering text) before reveal starts
    : scrollProgress > revealEnd 
      ? 0 // Fully transparent (text revealed) after reveal ends
      : 1 - (scrollProgress - revealStart) / (revealEnd - revealStart); // Fading out

  const textOpacity = 1 - maskOpacity; // Text becomes more visible as mask fades

  // Scale the mask down as it fades, or text up - let's scale text up
  const textScale = 0.8 + textOpacity * 0.2; // Scale from 0.8 to 1

  return (
    <div
      className="absolute inset-0 flex items-center justify-center -z-0" // Behind foreground icon, but potentially over background text layer
      style={{
        // This div itself can be the "mask" by having a background color
        // that matches the main page background, or by using clip-path with text.
        // For simplicity, we'll make the text itself appear/disappear and scale.
      }}
    >
      <div
        className="text-center px-4"
        style={{
          opacity: textOpacity,
          transform: `scale(${textScale})`,
          willChange: 'opacity, transform',
        }}
      >
        {/* This is the text that appears "through" the mask effect */}
        {/* We can use the same styling as the main title or a contrasting one */}
        <h1
          className={cn(
            "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-orbitron font-bold gta-vibe-text-effect",
             "text-transparent bg-clip-text bg-gradient-to-br from-brand-yellow to-brand-orange" // Example different color
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