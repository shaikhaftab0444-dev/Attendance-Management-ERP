import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCountUp } from '../../hooks/useCountUp';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  index?: number;
  trend?: {
    value: number | string;
    isPositive?: boolean;
    label?: string;
  };
  accentColor?: 'blue' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'teal' | 'cyan';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  index = 0,
  trend,
  accentColor = 'blue',
}) => {
  const animatedValue = useCountUp(value, 1000);

  const getAccentDetails = () => {
    switch (accentColor) {
      case 'emerald':
      case 'teal':
        return {
          iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          blobFill: '#10B981',
          tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
          blobFill: '#F59E0B',
          tagBg: 'bg-amber-50 text-amber-700 border-amber-200/60',
        };
      case 'rose':
        return {
          iconBg: 'bg-red-50 text-red-600 border-red-100',
          blobFill: '#EF4444',
          tagBg: 'bg-red-50 text-red-700 border-red-200/60',
        };
      case 'purple':
      case 'indigo':
        return {
          iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
          blobFill: '#8B5CF6',
          tagBg: 'bg-purple-50 text-purple-700 border-purple-200/60',
        };
      case 'cyan':
        return {
          iconBg: 'bg-cyan-50 text-cyan-600 border-cyan-100',
          blobFill: '#06B6D4',
          tagBg: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
        };
      case 'blue':
      default:
        return {
          iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
          blobFill: '#3B82F6',
          tagBg: 'bg-blue-50 text-blue-700 border-blue-200/60',
        };
    }
  };

  const { iconBg, blobFill, tagBg } = getAccentDetails();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: 'easeOut' }}
      className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Subtle decorative low-opacity blob/wave in background */}
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 w-36 h-36 rounded-full opacity-[0.06] blur-xl z-0 transition-opacity group-hover:opacity-[0.1]"
        style={{ backgroundColor: blobFill }}
      />
      <svg
        className="pointer-events-none absolute bottom-0 right-0 w-24 h-24 opacity-[0.04] z-0"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="80" cy="80" r="60" fill={blobFill} />
      </svg>

      <div className="relative z-10 space-y-4">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-xs ${iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>

          {trend && (
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                  : 'bg-red-50 text-red-600 border border-red-200/60'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        {/* Big Number & Labels */}
        <div>
          <div className="text-4xl font-bold text-slate-900 tracking-tight tabular-nums">
            {animatedValue}
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
        </div>

        {/* Subtitle / Pill */}
        {subtitle && (
          <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${tagBg}`}>
              {subtitle}
            </span>
            {trend?.label && (
              <span className="text-[11px] text-slate-400 font-medium">{trend.label}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
