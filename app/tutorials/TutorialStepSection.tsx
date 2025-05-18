"use client";
import React from 'react';
import { cn } from '@/lib/utils';

interface TutorialStepSectionProps {
  children: React.ReactNode;
  className?: string;
  isLastStep?: boolean;
}

const TutorialStepSection: React.FC<TutorialStepSectionProps> = ({ children, className, isLastStep }) => {
  return (
    <section className={cn(
      "py-10 md:py-16",
      !isLastStep && "border-b border-border/20", 
      className
    )}>
      {children}
    </section>
  );
};

TutorialStepSection.displayName = "TutorialStepSection";
export default TutorialStepSection;