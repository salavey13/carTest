"use client";
import React from 'react';
import { cn } from '@/lib/utils';

interface TutorialPageContainerProps {
  children: React.ReactNode;
  className?: string;
}

const TutorialPageContainer: React.FC<TutorialPageContainerProps> = ({ children, className }) => {
  return (
    <div className={cn(
      "relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand-pink/30 selection:text-brand-pink",
      className
    )}>
      {/* You can add global page effects here, like a subtle repeating background pattern if desired */}
      {/* <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] -z-20"></div> */}
      {children}
    </div>
  );
};

TutorialPageContainer.displayName = "TutorialPageContainer";
export default TutorialPageContainer;