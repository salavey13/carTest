import React from 'react';
    import type { VprPlotData, VprPlotPoint } from '@/lib/vprVisualData';
    import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

    interface PlotDisplayProps {
      plotData: VprPlotData;
    }

    // Helper to ensure x-values are numerical if possible for sorting/display
    const preparePlotData = (points: VprPlotPoint[]) => {
      return points.map(p => ({
        ...p,
        // Attempt to convert x to number if it looks like one, otherwise keep as string
        xValue: typeof p.x === 'string' && !isNaN(Number(p.x)) ? Number(p.x) : p.x,
      })).sort((a, b) => {
          // Basic sort for numbers or strings
          if (typeof a.xValue === 'number' && typeof b.xValue === 'number') {
              return a.xValue - b.xValue;
          }
          if (typeof a.xValue === 'string' && typeof b.xValue === 'string') {
              return a.xValue.localeCompare(b.xValue);
          }
          return 0; // Fallback if mixed types
      });
    };


    export function PlotDisplay({ plotData }: PlotDisplayProps) {
      const { points, xLabel, yLabel, title } = plotData;

      if (!points || points.length === 0) {
        return <div className="text-center text-yellow-500 italic">Данные для графика отсутствуют.</div>;
      }

      const preparedData = preparePlotData(points);
      const xType = typeof preparedData[0]?.xValue === 'number' ? 'number' : 'category';

      return (
        <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-inner">
          {title && <h4 className="text-sm font-semibold text-center text-gray-300 mb-3">{title}</h4>}
          <div style={{ width: '100%', height: 300 }}>
             <ResponsiveContainer>
              <LineChart
                data={preparedData}
                margin={{ top: 5, right: 20, left: 10, bottom: 25 }} // Adjust margins
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#4B5563" /> {/* Darker grid */}
                 <XAxis
                    dataKey="xValue"
                    type={xType} // Set type based on data
                    stroke="#9CA3AF" // Axis color
                    tick={{ fill: '#D1D5DB', fontSize: 10 }} // Tick label color/size
                    domain={xType === 'number' ? ['dataMin', 'dataMax'] : undefined} // Domain for numerical axis
                    label={{ value: xLabel, position: 'insideBottom', dy: 15, fill: '#9CA3AF', fontSize: 12 }} // Axis label
                    />
                <YAxis
                    stroke="#9CA3AF"
                    tick={{ fill: '#D1D5DB', fontSize: 10 }}
                    // Adjust domain slightly for padding
                    domain={['dataMin - 1', 'dataMax + 1']} // Example padding
                    label={{ value: yLabel, angle: -90, position: 'insideLeft', dx: -10, fill: '#9CA3AF', fontSize: 12 }}
                    tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : value} // Format large numbers
                    />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563' }} // Dark tooltip
                  labelStyle={{ color: '#E5E7EB' }}
                  itemStyle={{ color: '#38BDF8' }} // brand-cyan color
                   formatter={(value: number, name: string, props) => [`${value.toLocaleString()} ${yLabel || ''}`, props.payload?.label || name]} // Show label in tooltip
                   labelFormatter={(label) => ` ${xLabel || 'X'}: ${label}`}
                />
                {/* <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#D1D5DB' }}/> */}
                 <Line
                    type="monotone"
                    dataKey="y"
                    stroke="#38BDF8" // brand-cyan
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#0E7490' }} // Slightly darker dots
                    activeDot={{ r: 5, stroke: '#7DD3FC' }} // Lighter active dot
                    name={title || "Значение"} // Legend name
                 />
              </LineChart>
             </ResponsiveContainer>
          </div>
           <p className="text-xs text-center text-gray-500 mt-1 italic">(График схематичен)</p>
        </div>
      );
    }