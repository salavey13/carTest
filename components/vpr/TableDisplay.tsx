import React from 'react';
import type { VprTableData } from '@/lib/vprVisualData';

export function TableDisplay({ tableData }: { tableData: VprTableData }) {
  const { title, headers, rows } = tableData;

  return (
    <div className="my-4 w-full rounded-xl border border-white/10 bg-black/40 shadow-inner overflow-hidden">
      {title && (
        <div className="bg-white/5 px-4 py-3 border-b border-white/10">
          <h4 className="text-sm font-bold text-brand-cyan uppercase tracking-widest text-center">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs uppercase bg-black/60 text-gray-400 font-mono">
            <tr>
              {headers.map((head, i) => (
                <th key={i} className="px-6 py-3 border-r border-white/5 last:border-r-0">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-white/5 transition-colors group">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-6 py-4 border-r border-white/5 last:border-r-0 group-hover:text-white transition-colors">
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