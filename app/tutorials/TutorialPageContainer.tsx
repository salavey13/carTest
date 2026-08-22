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
      {children}
    </div>
  );
};

TutorialPageContainer.displayName = "TutorialPageContainer";
export default TutorialPageContainer;