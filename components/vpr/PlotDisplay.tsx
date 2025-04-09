import React from 'react';
import type { VprPlotData } from '@/lib/vprVisualData';

interface PlotDisplayProps {
  plotData: VprPlotData;
}

export function PlotDisplay({ plotData }: PlotDisplayProps) {
  const { points, title, xLabel, yLabel } = plotData;

  if (!points || points.length === 0) {
    return <div className="text-center text-yellow-500 italic my-4">Нет точек для отображения на графике.</div>;
  }

  // Very basic representation showing point values
  return (
    <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-inner">
      {title && <h4 className="text-sm font-semibold text-center text-gray-300 mb-3">{title}</h4>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
            <thead>
                <tr className="text-gray-400">
                    <th className="pb-1 border-b border-gray-600">{xLabel || 'X'}</th>
                    <th className="pb-1 border-b border-gray-600">{yLabel || 'Y'}</th>
                    {points[0]?.label && <th className="pb-1 border-b border-gray-600">Метка</th>}
                </tr>
            </thead>
            <tbody>
                {points.map((point, index) => (
                    <tr key={index} className="border-b border-gray-700 last:border-b-0">
                        <td className="py-1 pr-2 font-mono">{typeof point.x === 'number' ? point.x.toFixed(2) : point.x}</td>
                        <td className="py-1 pr-2 font-mono">{point.y.toFixed(2)}</td>
                        {point.label && <td className="py-1 text-gray-300">{point.label}</td>}
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      {xLabel && <p className="text-[10px] text-center text-gray-500 mt-2">{xLabel}</p>}
      <p className="text-xs text-center text-gray-500 mt-3 italic">(Вид графика схематичен)</p>
    </div>
  );
}