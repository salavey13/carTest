"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';

interface InputWithSteppersProps {
  label: string;
  id: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  unit?: string;
  description?: string;
  className?: string;
}

export const InputWithSteppers: React.FC<InputWithSteppersProps> = ({
  label,
  id,
  value,
  onValueChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  bigStep = 10,
  unit,
  description,
  className,
}) => {
  const handleStep = (amount: number) => {
    const newValue = parseFloat((value + amount).toPrecision(15));
    onValueChange(Math.max(min, Math.min(max, newValue)));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    if (!isNaN(numValue)) {
      onValueChange(Math.max(min, Math.min(max, numValue)));
    } else if (e.target.value === '') {
      // Allow clearing the input, maybe default to min or 0
      onValueChange(min !== -Infinity ? min : 0);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between items-center">
        <Label htmlFor={id} className="text-xs font-semibold text-foreground/80 dark:text-gray-300">
          {label}
        </Label>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-xs shrink-0 dark:border-brand-purple/50 dark:hover:bg-brand-purple/10"
          onClick={() => handleStep(-step)}
          disabled={value <= min}
        >
          -
        </Button>
        <Input
          id={id}
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          className="input-cyber h-8 text-center text-sm dark:border-brand-purple/50 dark:focus:border-brand-purple dark:focus:ring-brand-purple"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-xs shrink-0 dark:border-brand-purple/50 dark:hover:bg-brand-purple/10"
          onClick={() => handleStep(step)}
          disabled={value >= max}
        >
          +
        </Button>
      </div>
      {description && (
        <p className="text-[0.65rem] text-muted-foreground px-1">{description}</p>
      )}
    </div>
  );
};