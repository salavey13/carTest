import React from 'react';
    import type { VprChartData } from '@/lib/vprVisualData';

    interface SimpleChartProps {
      chartData: VprChartData;
    }

    export function SimpleChart({ chartData }: SimpleChartProps) {
      const { data, labels, title } = chartData;
      if (!data || data.length === 0 || data.length !== labels?.length) {
        return <div className="text-center text-yellow-500 italic">Данные для диаграммы некорректны.</div>;
      }

      const maxValue = Math.max(...data, 1); // Avoid division by zero if all data is 0

      return (
        <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-inner">
          {title && <h4 className="text-sm font-semibold text-center text-gray-300 mb-3">{title}</h4>}
          <div className="h-48 flex items-end justify-around space-x-2 px-2">
            {data.map((value, index) => (
              <div key={index} className="flex flex-col items-center flex-grow min-w-0" title={`${labels[index]}: ${value}`}>
                {/* Bar */}
                <div
                  className="w-full bg-brand-blue hover:bg-accent transition-colors duration-200 rounded-t"
                  style={{ height: `${Math.max((value / maxValue) * 100, 1)}%` }} // Ensure minimum visible height
                >
                  {/* Optional: Value inside bar if enough space */}
                  {/* <span className="text-xs text-white block text-center pt-1">{value}</span> */}
                </div>
                 {/* Label */}
                <span className="mt-1 text-xs text-center text-gray-400 break-words">
                  {labels[index]}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }