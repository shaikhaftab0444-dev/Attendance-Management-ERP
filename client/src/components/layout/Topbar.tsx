import React from 'react';
import { Menu, Calendar, Building, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
  onToggleSidebar: () => void;
  title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar, title }) => {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formatYearLabel = (y?: number) => {
    if (!y) return 'All Years';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const courseName =
    typeof user?.course === 'object' && user?.course
      ? user.course.name || user.course.code
      : null;

  const departmentName =
    typeof user?.department === 'object' && user?.department
      ? user.department.name
      : null;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title || 'Dashboard'}</h2>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              {today}
            </span>
            {user?.role === 'hod' && (
              <span className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-3 text-purple-700 font-semibold">
                <Building className="w-3.5 h-3.5 text-purple-600" />
                {courseName ? `${courseName} · ` : ''}{formatYearLabel(user.year)} HOD
              </span>
            )}
            {user?.role === 'teacher' && departmentName && (
              <span className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 pl-3 text-teal-700 font-semibold">
                <Building className="w-3.5 h-3.5 text-teal-600" />
                {departmentName}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Live Sync Active</span>
        </div>
      </div>
    </header>
  );
};
