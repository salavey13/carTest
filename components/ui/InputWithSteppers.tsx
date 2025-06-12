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
  label?: string;
  id?: string;
  unit?: string;
  description?: string; // Added for descriptions
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
    let newValue = parseFloat((value + amount).toFixed(Math.max(countDecimals(step), countDecimals(amount)) + 1)); 
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
    if (rawValue === "" || rawValue === "-") { // Allow empty or just minus for typing
        // Let onBlur handle final validation / setting default
        // For direct typing, you might want to allow more flexibility
        // For now, if it's not a parseable number, it won't update immediately
        // but onBlur will correct it.
        // If you want immediate update on every keystroke that forms a valid partial number,
        // this logic would need to be more complex.
        // For controlled input, the parent `value` will snap it back if invalid.
        const numValue = parseFloat(rawValue);
        if(!isNaN(numValue)) { // If it's a valid start of a number
            onValueChange(numValue); // Allow partial update
        } else if (rawValue === "" && min !== undefined) {
            // onValueChange(min); // Or handle as desired
        }
        return;
    }
    let numValue = parseFloat(rawValue);
    if (!isNaN(numValue)) {
        // No clamping here during typing, allow user to type out of bounds temporarily
        // Clamping will happen onBlur or if parent re-renders with clamped value
        onValueChange(numValue);
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let numValue = parseFloat(e.target.value);
     if (isNaN(numValue)) {
        numValue = (value !== undefined && !isNaN(value)) ? value : (min !== undefined ? min : 0); 
     }
    if (min !== undefined) numValue = Math.max(min, numValue);
    if (max !== undefined) numValue = Math.min(max, numValue);
    onValueChange(numValue); 
  };

  return (
    <div className="space-y-1">
      {label && (
        <Label htmlFor={id || restInputProps.name} className="text-xs font-semibold text-gray-300/80">
          {label} {unit && <span className="text-gray-500">{`(${unit})`}</span>}
        </Label>
      )}
      <div className="flex items-center space-x-1">
        <Button variant="outline" size="xs" onClick={() => handleStep(-bigStep)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={min !== undefined && value <= min} aria-label={`Decrease ${label} by ${bigStep}`}>
          <VibeContentRenderer content="::FaAngleDoubleLeft::" />
        </Button>
        <Button variant="outline" size="xs" onClick={() => handleStep(-step)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={min !== undefined && value <= min} aria-label={`Decrease ${label} by ${step}`}>
          <VibeContentRenderer content="::FaAngleLeft::" />
        </Button>
        <Input
          id={id || restInputProps.name}
          type="number"
          value={value} // Value should be number here
          onChange={handleInputChange}
          onBlur={handleBlur}
          step={step}
          min={min}
          max={max}
          className={cn("input-cyber text-sm h-8 text-center focus:border-brand-pink focus:ring-brand-pink", className)}
          {...restInputProps}
        />
        <Button variant="outline" size="xs" onClick={() => handleStep(step)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={max !== undefined && value >= max} aria-label={`Increase ${label} by ${step}`}>
          <VibeContentRenderer content="::FaAngleRight::" />
        </Button>
        <Button variant="outline" size="xs" onClick={() => handleStep(bigStep)} className="h-8 w-8 px-1 border-brand-pink/50 text-brand-pink hover:bg-brand-pink/10 disabled:opacity-40" disabled={max !== undefined && value >= max} aria-label={`Increase ${label} by ${bigStep}`}>
          <VibeContentRenderer content="::FaAngleDoubleRight::" />
        </Button>
      </div>
      {description && <p className="text-[0.65rem] text-muted-foreground/80 pt-0.5 px-1">{description}</p>}
    </div>
  );
};