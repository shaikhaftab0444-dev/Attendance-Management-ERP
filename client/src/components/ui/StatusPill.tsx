import React from 'react';

export type StatusType = 'present' | 'absent' | 'late' | 'active' | 'inactive' | 'admin' | 'hod' | 'teacher';

interface StatusPillProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label, size = 'sm' }) => {
  const normStatus = (status || '').toLowerCase();

  const getStyle = () => {
    switch (normStatus) {
      case 'present':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'absent':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'late':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'inactive':
        return 'bg-slate-100 text-slate-600 border border-slate-200';
      case 'admin':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'hod':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'teacher':
        return 'bg-teal-50 text-teal-700 border border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const displayText = label || (normStatus.charAt(0).toUpperCase() + normStatus.slice(1));
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold rounded-full uppercase tracking-wider ${sizeClasses} ${getStyle()}`}
    >
      {displayText}
    </span>
  );
};
