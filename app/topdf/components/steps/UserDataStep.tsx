"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { StepWrapper } from '../StepWrapper';

interface UserDataStepProps {
  translations: (key: string, replacements?: Record<string, string | number>) => string;
  userName: string;
  setUserName: (value: string) => void;
  userAge: string;
  setUserAge: (value: string) => void;
  userGender: string;
  setUserGender: (value: string) => void;
  onContinue: () => void;
  onBack: () => void;
  currentLang: 'en' | 'ru';
}

export const UserDataStep: React.FC<UserDataStepProps> = ({
  translations: t,
  userName, setUserName,
  userAge, setUserAge,
  userGender, setUserGender,
  onContinue, onBack, currentLang
}) => {
  return (
    <StepWrapper title={t("prizmaUserDataPrompt")} onBack={onBack} showBackButton>
      <div className="space-y-4">
        <div>
          <Label htmlFor="userName" className="text-sm font-medium text-muted-foreground">
            {t("userNameLabel")}
          </Label>
          <Input
            id="userName"
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={currentLang === 'ru' ? "Иван Иванов" : "John Doe"}
            className="w-full mt-1 input-cyber"
          />
        </div>
        <div>
          <Label htmlFor="userAge" className="text-sm font-medium text-muted-foreground">
            {t("userAgeLabel")}
          </Label>
          <Input
            id="userAge"
            type="text"
            value={userAge}
            onChange={(e) => setUserAge(e.target.value)}
            placeholder="30"
            className="w-full mt-1 input-cyber"
          />
        </div>
        <div>
          <Label htmlFor="userGender" className="text-sm font-medium text-muted-foreground">
            {t("userGenderLabel")}
          </Label>
          <Input
            id="userGender"
            type="text"
            value={userGender}
            onChange={(e) => setUserGender(e.target.value)}
            placeholder={currentLang === 'ru' ? "Мужчина/Женщина" : "Male/Female"}
            className="w-full mt-1 input-cyber"
          />
        </div>
      </div>
      <Button onClick={onContinue} size="lg" className="w-full mt-8 bg-brand-gradient-purple-blue text-white font-semibold py-3 text-lg shadow-md hover:opacity-90 transition-opacity">
        {t("prizmaContinue")} <VibeContentRenderer content="::FaChevronRight className='ml-2'::"/>
      </Button>
    </StepWrapper>
  );
};