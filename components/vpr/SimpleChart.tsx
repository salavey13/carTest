import React from 'react';
import type { VprChartData } from '@/lib/vprVisualData';

interface SimpleChartProps {
  chartData: VprChartData;
}

export function SimpleChart({ chartData }: SimpleChartProps) {
  const { data, labels, title, chartType = 'bar', colors } = chartData;
  const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const safeColors = colors || defaultColors;

  const maxValue = Math.max(...data, 0);

  // Pie Chart Logic
  const total = data.reduce((sum, val) => sum + val, 0);
  let accumulatedDeg = 0;
  const conicSegments = data.map((val, i) => {
    const start = accumulatedDeg;
    const deg = (val / total) * 360;
    accumulatedDeg += deg;
    return `${safeColors[i % safeColors.length]} ${start}deg ${accumulatedDeg}deg`;
  });
  const pieStyle = { background: `conic-gradient(${conicSegments.join(', ')})` };

  return (
    <div className="my-6 p-5 bg-gray-800 border border-gray-700 rounded-xl shadow-lg">
      {title && <h4 className="text-base font-semibold text-center text-gray-200 mb-4">{title}</h4>}

      {/* BAR CHART */}
      {chartType === 'bar' && (
        <div className="flex justify-around items-end h-40 gap-2">
          {data.map((value, index) => (
            <div key={labels[index]} className="flex flex-col items-center text-center w-full">
              <div className="relative w-full max-w-[40px] group">
                 <div
                    className="w-full rounded-t-md transition-all duration-500 ease-out"
                    style={{
                        height: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%`,
                        backgroundColor: safeColors[index % safeColors.length]
                    }}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-xs bg-black px-1 rounded text-white transition-opacity">
                      {value}
                  </div>
              </div>
              <span className="text-[10px] md:text-xs text-gray-400 mt-2 truncate w-full">{labels[index]}</span>
            </div>
          ))}
        </div>
      )}

      {/* PIE CHART */}
      {chartType === 'pie' && (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="w-32 h-32 rounded-full shadow-inner" style={pieStyle}></div>
            <div className="flex flex-col gap-2">
                {labels.map((label, i) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full" style={{backgroundColor: safeColors[i % safeColors.length]}}></span>
                        <span className="text-gray-300">{label}:</span>
                        <span className="font-mono font-bold text-gray-100">{data[i]}</span>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}