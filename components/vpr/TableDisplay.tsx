import React from 'react';
import type { VprTableData } from '@/lib/vprVisualData';

interface TableDisplayProps {
  tableData: VprTableData;
}

export function TableDisplay({ tableData }: TableDisplayProps) {
  const { title, headers, rows } = tableData;

  return (
    <div className="my-6 w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800/50 shadow-sm">
      {title && (
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <h4 className="text-sm font-semibold text-gray-200 text-center">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
            <tr>
              {headers.map((head, i) => (
                <th key={i} scope="col" className="px-4 py-3 border-r border-gray-700 last:border-r-0">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-gray-700 hover:bg-gray-700/30 transition-colors last:border-b-0"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 font-mono border-r border-gray-700/50 last:border-r-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}