"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image'; // Используем Image для HERO_IMAGE_URL

interface IntroStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  onStartAnalysis: () => void;
  heroImageUrl: string;
}

export const IntroStep: React.FC<IntroStepProps> = ({ translations: t, onStartAnalysis, heroImageUrl }) => {
  return (
    <div className="w-full max-w-md mx-auto p-6 md:p-8 space-y-6 text-center">
      <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 rounded-full overflow-hidden shadow-lg animate-pulse-slow relative">
        <Image 
          src={heroImageUrl} 
          alt="PRIZMA Sphere" 
          layout="fill"
          objectFit="cover"
          priority
        />
      </div>
      <h1 className="text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-pink via-brand-purple to-brand-blue mb-3">
        {t("prizmaIntroTitle")}
      </h1>
      <p className="text-lg text-muted-foreground mb-2">{t("prizmaIntroSubtitle")}</p>
      <p className="text-sm text-muted-foreground mb-8">{t("prizmaIntroDesc")}</p>
      <Button onClick={onStartAnalysis} size="lg" className="w-full bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
        {t("prizmaStartAnalysis")} <VibeContentRenderer content="::FaChevronRight className='ml-2'::"/>
      </Button>
    </div>
  );
};