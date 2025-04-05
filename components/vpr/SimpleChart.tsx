import React from 'react';
import type { VprChartData } from '@/lib/vprVisualData';

interface SimpleChartProps {
  chartData: VprChartData;
}

export function SimpleChart({ chartData }: SimpleChartProps) {
  const { data, labels, title } = chartData;

  // Basic validation
  if (!data || data.length === 0 || !labels || data.length !== labels.length) {
    return (
      <div className="text-center text-yellow-500 italic p-4">
        Данные для диаграммы некорректны или отсутствуют.
      </div>
    );
  }

  // Find max value, ensure it's at least 1 to avoid division by zero or overly large bars if max is < 1
  const maxValue = Math.max(...data, 1);
  const valueLabelThresholdPercent = 15; // Show label inside bar if height is >= 15%

  return (
    <div className="my-4 p-4 bg-card border border-border rounded-lg shadow-md">
      {title && (
        <h4 className="text-sm font-semibold text-center text-card-foreground mb-4">
          {title}
        </h4>
      )}
      <div className="h-48 flex items-end justify-around space-x-2 px-2" aria-label={title || 'Chart'}>
        {data.map((value, index) => {
          const barHeightPercent = Math.max((value / maxValue) * 100, 0.5); // Min height 0.5% for visibility
          const showValueInside = barHeightPercent >= valueLabelThresholdPercent;
          const labelText = labels[index] ?? `Item ${index + 1}`; // Fallback label

          return (
            <div
              key={index}
              className="flex flex-col items-center flex-grow min-w-0 h-full justify-end" // Ensure columns take full height for alignment
              title={`${labelText}: ${value}`} // Tooltip for accessibility and desktop hover
            >
              {/* Value Label (shown above if bar is too short) */}
              {!showValueInside && value > 0 && (
                 <span className="text-xs text-card-foreground font-medium mb-0.5" aria-hidden="true">
                   {value}
                 </span>
               )}

              {/* Bar */}
              <div
                className="w-full bg-brand-blue hover:bg-secondary transition-colors duration-200 rounded-t relative flex justify-center items-start" // Use secondary for hover, relative positioning for inner text
                style={{ height: `${barHeightPercent}%` }}
                role="img" // Indicate it's a graphical element
                aria-label={`${labelText}, value ${value}`} // More specific aria-label for screen readers
              >
                {/* Value Label (shown inside if bar is tall enough) */}
                {showValueInside && (
                  <span className="absolute top-0 text-xs text-black font-semibold block text-center pt-0.5 px-0.5 overflow-hidden text-ellipsis whitespace-nowrap w-full" aria-hidden="true">
                    {value}
                  </span>
                )}
              </div>

              {/* Category Label (X-axis) */}
              <span className="mt-1.5 text-xs text-center text-muted-foreground break-words w-full">
                {labelText}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}