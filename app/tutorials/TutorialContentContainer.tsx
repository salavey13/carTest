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
      "container mx-auto px-4 py-12 md:py-16 relative z-10", // z-10 to be above fixed/sticky hero after it's scrolled past
      "bg-background", // Ensures it has a background to cover hero content below
      className
    )}>
      {children}
    </div>
  );
};

TutorialContentContainer.displayName = "TutorialContentContainer";
export default TutorialContentContainer;