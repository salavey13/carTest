"use client";

import React from 'react';
import { Button } from "./button";
import { Input, type InputProps } from "./input";
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // Assuming this path
import { cn } from "@/lib/utils";

interface InputWithSteppersProps extends InputProps {
  onValueChange: (newValue: number) => void;
  value: number;
  step?: number;
  bigStep?: number;
  min?: number;
  max?: number;
  label?: string;
  id?: string;
  unit?: string;
  description?: string;
}

export const InputWithSteppers: React.FC<InputWithSteppersProps> = ({
  onValueChange,
  value,
  step = 0.1,
  bigStep = 1,
  min,
  max,
  label,
  id,
  unit,
  description,
  className,
  ...restInputProps
}) => {
  const handleStep = (amount: number) => {
    let newValue = parseFloat((value + amount).toFixed(Math.max(countDecimals(step), countDecimals(amount)) + 1)); // Handle float precision
    if (min !== undefined) newValue = Math.max(min, newValue);
    if (max !== undefined) newValue = Math.min(max, newValue);
    onValueChange(newValue);
  };

  const countDecimals = (num: number) => {
    if (Math.floor(num) === num) return 0;
    try {
      return num.toString().split(".")[1].length || 0;
    } catch (e) {
      return 0;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "") {
        // Allow temporarily empty for typing, could reset to min on blur if desired
        // For now, let parent decide if it's an invalid state / how to handle empty
        // onValueChange(min !== undefined ? min : 0); // Example: reset to min if empty
        return; // Or let it be, parent validation will catch it
    }
    let numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
        if (min !== undefined) numValue = Math.max(min, numValue);
        if (max !== undefined) numValue = Math.min(max, numValue);
        onValueChange(numValue);
    }
  };
  
  const handleBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    let numValue = parseFloat(e.target.value);
     if (isNaN(numValue)) {
        numValue = min !== undefined ? min : 0; // Fallback to min or 0 if invalid on blur
     }
    if (min !== undefined) numValue = Math.max(min, numValue);
    if (max !== undefined) numValue = Math.min(max, numValue);
    onValueChange(numValue); // Ensure value is clamped on blur
  };


  return (
    <div className="space-y-1.5">
      {label && (
        <Label htmlFor={id || restInputProps.name} className="text-xs font-semibold text-gray-300 flex justify-between items-center">
          <span>{label} {unit && `(${unit})`}</span>
          {/* Display current value if not part of a range component */}
        </Label>
      )}
      <div className="flex items-center space-x-1">
        <Button variant="outline" size="icon" onClick={() => handleStep(-bigStep)} className="h-8 w-8 border-brand-pink/70 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-50" disabled={min !== undefined && value <= min}>
          <VibeContentRenderer content="::FaAngleDoubleLeft::" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => handleStep(-step)} className="h-8 w-8 border-brand-pink/70 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-50" disabled={min !== undefined && value <= min}>
          <VibeContentRenderer content="::FaAngleLeft::" />
        </Button>
        <Input
          id={id || restInputProps.name}
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
        <Button variant="outline" size="icon" onClick={() => handleStep(step)} className="h-8 w-8 border-brand-pink/70 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-50" disabled={max !== undefined && value >= max}>
          <VibeContentRenderer content="::FaAngleRight::" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => handleStep(bigStep)} className="h-8 w-8 border-brand-pink/70 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-50" disabled={max !== undefined && value >= max}>
          <VibeContentRenderer content="::FaAngleDoubleRight::" />
        </Button>
      </div>
      {description && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
    </div>
  );
};