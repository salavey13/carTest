"use client";
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

// Assuming colorClasses is defined globally or passed as prop if needed for dynamic button colors
// For simplicity, this example uses direct Tailwind classes or a passed mainColorClassKey for theming.

interface NextLevelTeaserProps {
  title: string;
  text: string;
  buttonText: string;
  buttonLink: string;
  mainColorClassKey?: string; // e.g., "brand-green", "brand-pink"
}

const NextLevelTeaser: React.FC<NextLevelTeaserProps> = ({ 
  title, 
  text, 
  buttonText, 
  buttonLink, 
  mainColorClassKey = "brand-green" // Default color
}) => {
  // Construct color classes dynamically if needed, or use Tailwind's arbitrary properties with CSS vars
  const titleColorClass = `text-${mainColorClassKey}`;
  const borderColorClass = `border-${mainColorClassKey}/30`;
  const buttonBgClass = `bg-${mainColorClassKey}`;
  const buttonHoverBgClass = `hover:bg-${mainColorClassKey}/80`;
  // For shadows, you might need to have predefined shadow classes in globals.css or tailwind.config.js
  // e.g., shadow-brand-green-glow. For now, using a generic shadow.
  const buttonShadowClass = `shadow-lg hover:shadow-xl`;


  return (
    <section className={cn(
        "mt-16 md:mt-24 text-center py-12 md:py-16",
        `border-t ${borderColorClass}` // Uses dynamic border color or default
    )}>
        <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", titleColorClass)}>
            <VibeContentRenderer content={title} />
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={text} />
        </p>
        <Button asChild className={cn(
            "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full transition-transform transform hover:scale-105",
            "text-background", // Assuming button text should contrast with its bg
            buttonBgClass,
            buttonHoverBgClass,
            buttonShadowClass 
            // Example for specific shadow if defined in tailwind.config: `hover:shadow-${mainColorClassKey}-glow`
        )}>
            <Link href={buttonLink}>
                <VibeContentRenderer content={buttonText} />
            </Link>
        </Button>
    </section>
  );
};

NextLevelTeaser.displayName = "NextLevelTeaser";
export default NextLevelTeaser;