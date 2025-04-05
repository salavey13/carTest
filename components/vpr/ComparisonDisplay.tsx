import React from 'react';
    import { Box, Users } from 'lucide-react'; // Example icons
    import type { VprCompareData } from '@/lib/vprVisualData';

    interface ComparisonDisplayProps {
      compareData: VprCompareData;
    }

    export function ComparisonDisplay({ compareData }: ComparisonDisplayProps) {
      const { size1, size2, label1, label2, referenceLabel } = compareData;

      // Determine which is visually larger/smaller based on size props
      const is1Larger = size1 > size2;
      const largeSize = 64; // Size for the larger icon
      const smallSize = 40; // Size for the smaller icon

      return (
        <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-inner">
          {referenceLabel && <p className="text-xs text-center text-gray-400 mb-3 italic">{referenceLabel}</p>}
          <div className="flex justify-around items-center">
            {/* Item 1 */}
            <div className="flex flex-col items-center text-center">
              {/* Use appropriate icons based on labels if possible, fallback to Box */}
              <Box size={is1Larger ? largeSize : smallSize} className="text-brand-purple mb-1" />
              <span className="text-sm text-gray-300">{label1}</span>
               <span className="text-xs text-gray-500">(Размер {size1})</span> {/* Show value for context */}
            </div>

            {/* Item 2 */}
            <div className="flex flex-col items-center text-center">
               {/* Use different icon or color */}
              <Users size={!is1Larger ? largeSize : smallSize} className="text-brand-cyan mb-1" />
              <span className="text-sm text-gray-300">{label2}</span>
               <span className="text-xs text-gray-500">(Размер {size2})</span> {/* Show value for context */}
            </div>
          </div>
           <p className="text-xs text-center text-gray-500 mt-3 italic">(Размеры и иконки схематичны)</p>
        </div>
      );
    }