import React from 'react';
    import type { VprAxisData } from '@/lib/vprVisualData';

    export function AxisDisplay({ axisData }: { axisData: VprAxisData }) {
        const { points, minVal, maxVal } = axisData;

        if (!points || points.length === 0) {
             return <div className="text-center text-yellow-500 italic">Нет точек для отображения на оси.</div>;
        }

        const sortedPoints = [...points].sort((a, b) => a.value - b.value);

        // Determine range, ensuring points are included, add padding
        const pointValues = sortedPoints.map(p => p.value);
        const dataMin = Math.min(...pointValues);
        const dataMax = Math.max(...pointValues);
        const padding = Math.max(1, (dataMax - dataMin) * 0.1); // Add 10% padding or at least 1 unit

        const rangeMin = minVal ?? Math.floor(dataMin - padding);
        const rangeMax = maxVal ?? Math.ceil(dataMax + padding);
        const range = rangeMax - rangeMin;

        if (range <= 0) return <div className="text-red-500">Неверный диапазон оси ({rangeMin} - {rangeMax})</div>;

        const getPosition = (value: number) => {
            // Clamp value within range for positioning to avoid going off-axis visually
            const clampedValue = Math.max(rangeMin, Math.min(rangeMax, value));
            return ((clampedValue - rangeMin) / range) * 100;
        };

        // Determine ticks to display - aim for around 5-10 ticks
        const tickInterval = Math.pow(10, Math.floor(Math.log10(range / 5))) || 1; // Adjust interval based on range
        let ticks = [];
        for (let i = Math.ceil(rangeMin / tickInterval) * tickInterval; i <= rangeMax; i += tickInterval) {
             // Round ticks to avoid floating point issues if interval is decimal
             const roundedTick = parseFloat(i.toFixed(2));
             if (roundedTick >= rangeMin && roundedTick <= rangeMax) {
                ticks.push(roundedTick);
             }
        }
        // Ensure 0 is included if within range
        if (rangeMin <= 0 && rangeMax >= 0 && !ticks.includes(0)) {
            ticks.push(0);
            ticks.sort((a, b) => a - b);
        }


        return (
            <div className="w-full my-6 px-4 py-6 bg-gray-800 border border-gray-700 rounded-lg relative h-20 select-none">
                 {/* Axis Line */}
                 <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-gray-500 transform -translate-y-1/2"></div>

                 {/* Ticks */}
                 {ticks.map(tick => (
                     <div
                         key={`tick-${tick}`}
                         className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                         style={{ left: `${getPosition(tick)}%` }}
                     >
                     <div className={`w-px bg-gray-600 ${tick === 0 ? 'h-3' : 'h-2'}`}></div> {/* Main tick line */}
                     <span className={`text-[10px] mt-1 ${tick === 0 ? 'font-semibold text-gray-200' : 'text-gray-400'}`}>{tick}</span>
                     </div>
                 ))}

                 {/* Points */}
                 {sortedPoints.map((point) => (
                     <div
                        key={point.label}
                        className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 flex flex-col items-center cursor-default group" // Added group for potential hover effects
                        style={{ left: `${getPosition(point.value)}%` }}
                        title={`${point.label} (${point.value})`} // Tooltip for value
                     >
                         {/* Point marker - slightly above the axis line */}
                         <div className="w-2 h-2 bg-brand-cyan rounded-full border border-dark-bg absolute -top-4 group-hover:scale-125 transition-transform"></div>
                         {/* Label below the axis line */}
                         <span className="text-sm font-semibold text-brand-cyan absolute top-3">{point.label}</span>
                    </div>
                 ))}
                 <p className="text-xs text-center text-gray-500 mt-12 italic">(Положение точек схематично)</p>
            </div>
        );
    }