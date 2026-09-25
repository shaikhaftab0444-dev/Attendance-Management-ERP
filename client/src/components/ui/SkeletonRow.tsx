import React from 'react';

interface SkeletonRowProps {
  columns: number;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ columns }) => {
  return (
    <tr className="animate-pulse block bg-white p-4 rounded-2xl border border-slate-200/90 mb-3 md:mb-0 md:border-b md:border-slate-100 md:p-0 md:bg-transparent md:rounded-none md:shadow-none md:table-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="flex items-center justify-between py-1.5 px-0 border-b border-slate-50 last:border-b-0 md:border-none md:table-cell md:py-3.5 md:px-4">
          <div className="h-3.5 bg-slate-100 rounded w-20 md:hidden"></div>
          <div className="h-4 bg-slate-100 rounded-md w-32 md:w-full md:max-w-[80%]"></div>
        </td>
      ))}
    </tr>
  );
};
