import React from 'react';
import type { VprChartData } from '@/lib/vprVisualData';

interface SimpleChartProps {
  chartData: VprChartData;
}

export function SimpleChart({ chartData }: SimpleChartProps) {
  const { data, labels, title, chartType = 'bar' } = chartData;

  // Basic visual representation without a library
  const maxValue = Math.max(...data, 0);

  return (
    <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-inner">
      {title && <h4 className="text-sm font-semibold text-center text-gray-300 mb-3">{title}</h4>}
      <div className={`flex ${chartType === 'bar' ? 'justify-around items-end h-32' : 'flex-col space-y-1'} gap-2`}>
        {data.map((value, index) => (
          chartType === 'bar' ? (
            <div key={labels[index]} className="flex flex-col items-center text-center w-1/4">
              <div
                className="bg-brand-cyan w-4/5"
                style={{ height: `${maxValue > 0 ? (value / maxValue) * 100 : 0}%` }}
                title={`${labels[index]}: ${value}`}
              ></div>
              <span className="text-xs text-gray-400 mt-1">{labels[index]}</span>
            </div>
          ) : (
            // Simple list representation for pie/other
            <div key={labels[index]} className="flex justify-between text-xs">
                <span className="text-gray-300">{labels[index]}</span>
                <span className="text-brand-cyan font-mono">{value}</span>
            </div>
          )
        ))}
      </div>
      <p className="text-xs text-center text-gray-500 mt-3 italic">(Вид диаграммы схематичен)</p>
    </div>
  );
}