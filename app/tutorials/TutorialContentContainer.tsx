"use client";
import React from 'react';
import { cn } from '@/lib/utils';

interface TutorialContentContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TutorialContentContainer: React.FC<TutorialContentContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      "container mx-auto px-4 py-12 md:py-16 relative", // Keep relative for stacking context if needed below fixed hero
      "bg-background", 
      className
      // z-10 removed as fixed hero will have higher z-index if needed.
      // Background ensures it covers content behind it if hero is transparent.
    )}>
      {children}
    </div>
  );
};

TutorialContentContainer.displayName = "TutorialContentContainer";
export default TutorialContentContainer;