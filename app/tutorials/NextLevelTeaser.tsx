"use client";
import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

interface NextLevelTeaserProps {
  title: string;
  text: string;
  buttonText: string;
  buttonLink: string;
  mainColorClassKey?: string; 
}

const NextLevelTeaser: React.FC<NextLevelTeaserProps> = ({ 
  title, 
  text, 
  buttonText, 
  buttonLink, 
  mainColorClassKey = "brand-green" 
}) => {
  
  const titleColorClass = `text-${mainColorClassKey}`;
  const borderColorClass = `border-${mainColorClassKey}/30`;
  const buttonBgClass = `bg-${mainColorClassKey}`;
  const buttonHoverBgClass = `hover:bg-${mainColorClassKey}/80`;
  // For shadows, you might need to have predefined shadow classes in globals.css or tailwind.config.js
  // e.g., shadow-brand-green-glow. For now, using a generic shadow.
  // This assumes that Tailwind JIT can pick up `shadow-brand-green/30` if `brand-green` is a defined color.
  const buttonShadowClass = `shadow-lg hover:shadow-xl shadow-${mainColorClassKey}/30 hover:shadow-${mainColorClassKey}/50`;


  return (
    <section className={cn(
        "mt-16 md:mt-24 text-center py-12 md:py-16",
        `border-t ${borderColorClass}` 
    )}>
        <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", titleColorClass)}>
            <VibeContentRenderer content={title} />
        </h2>
        <p className="text-lg md:text-xl text-muted-foreground font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={text} />
        </p>
        <Button asChild className={cn(
            "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full transition-transform transform hover:scale-105",
            "text-background", 
            buttonBgClass,
            buttonHoverBgClass,
            buttonShadowClass 
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