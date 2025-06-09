"use client";
import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';

interface StepWrapperProps {
  children: React.ReactNode;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
  currentLang?: 'en' | 'ru'; // Optional, for "Back" button text
}

export const StepWrapper: React.FC<StepWrapperProps> = ({
  children,
  title,
  showBackButton,
  onBack,
  className,
  currentLang = 'ru' // Default to 'ru' if not provided
}) => {
  return (
    <div className={cn("w-full max-w-md mx-auto p-6 md:p-8 space-y-6 bg-card rounded-xl shadow-xl relative", className)}>
      {showBackButton && onBack && (
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground px-2 py-1" // Adjusted padding for smaller button
        >
          <VibeContentRenderer content="::FaArrowLeft className='w-4 h-4 mr-1.5'::" />
          {currentLang === 'ru' ? 'Назад' : 'Back'}
        </Button>
      )}
      {title && <h2 className="text-2xl font-orbitron font-bold text-center text-foreground pt-8 sm:pt-4">{title}</h2>}
      {children}
    </div>
  );
};