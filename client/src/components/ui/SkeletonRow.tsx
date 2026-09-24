import React from 'react';

interface SkeletonRowProps {
  columns: number;
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({ columns }) => {
  return (
    <tr className="animate-pulse border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <div className="h-4 bg-slate-100 rounded-md w-full max-w-[80%]"></div>
        </td>
      ))}
    </tr>
  );
};
