"use client";

import React from 'react';
import { Button } from "./button";
import { Input, type InputProps } from "./input";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from "@/lib/utils";

interface InputWithSteppersProps extends InputProps {
  onValueChange: (newValue: number) => void;
  value: number;
  step?: number;
  bigStep?: number;
  min?: number;
  max?: number;
}

export const InputWithSteppers: React.FC<InputWithSteppersProps> = ({
  onValueChange,
  value,
  step = 0.1,
  bigStep = 1,
  min,
  max,
  className,
  ...restInputProps
}) => {
  
  const countDecimals = (num: number) => {
    if (Math.floor(num) === num) return 0;
    try {
      return num.toString().split(".")[1].length || 0;
    } catch (e) {
      return 0;
    }
  };

  const handleStep = (amount: number) => {
    let newValue = parseFloat((value + amount).toFixed(Math.max(countDecimals(step), countDecimals(bigStep)) + 1));
    if (min !== undefined) newValue = Math.max(min, newValue);
    if (max !== undefined) newValue = Math.min(max, newValue);
    onValueChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "" || rawValue === "-") {
      // Allow user to clear the input or type a negative sign
      // The onBlur event will handle validation if they leave it empty/invalid
    } else {
        const numValue = parseFloat(rawValue);
        if (!isNaN(numValue)) {
            // Update immediately as they type, but don't clamp yet for better UX
            onValueChange(numValue);
        }
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let numValue = parseFloat(e.target.value);
     if (isNaN(numValue)) {
        // If they leave it blank or invalid, revert to the last valid value or a default
        numValue = (value !== undefined && !isNaN(value)) ? value : (min !== undefined ? min : 0); 
     }
    // Clamp the value on blur
    if (min !== undefined) numValue = Math.max(min, numValue);
    if (max !== undefined) numValue = Math.min(max, numValue);
    onValueChange(numValue); 
  };

  return (
    <div className="flex items-center space-x-1">
        <Button variant="outline" size="xs" onClick={() => handleStep(-bigStep)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={min !== undefined && value <= min} aria-label={`Decrease by ${bigStep}`}>
            <VibeContentRenderer content="::FaAnglesLeft::" />
        </Button>
        <Button variant="outline" size="xs" onClick={() => handleStep(-step)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={min !== undefined && value <= min} aria-label={`Decrease by ${step}`}>
            <VibeContentRenderer content="::FaAngleLeft::" />
        </Button>
        <Input
          type="number"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          step={step}
          min={min}
          max={max}
          className={cn("input-cyber text-sm h-8 text-center focus:border-brand-pink focus:ring-brand-pink", className)}
          {...restInputProps}
        />
        <Button variant="outline" size="xs" onClick={() => handleStep(step)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={max !== undefined && value >= max} aria-label={`Increase by ${step}`}>
            <VibeContentRenderer content="::FaAngleRight::" />
        </Button>
        <Button variant="outline" size="xs" onClick={() => handleStep(bigStep)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={max !== undefined && value >= max} aria-label={`Increase by ${bigStep}`}>
            <VibeContentRenderer content="::FaAnglesRight::" />
        </Button>
    </div>
  );
};