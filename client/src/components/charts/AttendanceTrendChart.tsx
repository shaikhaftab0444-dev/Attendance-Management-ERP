import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface TrendDataPoint {
  date: string;
  percentage: number;
  present?: number;
  late?: number;
  absent?: number;
}

interface AttendanceTrendChartProps {
  data: TrendDataPoint[];
  threshold?: number;
}

export const AttendanceTrendChart: React.FC<AttendanceTrendChartProps> = ({
  data,
  threshold = 75,
}) => {
  const formattedData = data.map((d) => ({
    ...d,
    displayDate: d.date.length > 5 ? d.date.slice(5) : d.date, // MM-DD
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-900">{p.date}</p>
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">Attendance:</span>
            <span className="font-bold text-slate-900 tabular-nums">{p.percentage}%</span>
          </div>
          {p.present !== undefined && (
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 space-y-0.5">
              <div>Present: <span className="text-emerald-600 font-bold">{p.present}</span></div>
              <div>Late: <span className="text-amber-600 font-bold">{p.late}</span></div>
              <div>Absent: <span className="text-rose-600 font-bold">{p.absent}</span></div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="displayDate"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94A3B8"
            fontSize={11}
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="percentage"
            stroke="#3B82F6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#attendanceGradient)"
            dot={{ r: 3, fill: '#3B82F6', strokeWidth: 1, stroke: '#FFFFFF' }}
            activeDot={{ r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#FFFFFF' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
