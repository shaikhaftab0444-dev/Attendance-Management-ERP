import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';

interface BarDataPoint {
  name: string;
  code?: string;
  attendancePercentage: number;
  totalPeriods?: number;
}

interface SectionCompareBarProps {
  data: BarDataPoint[];
  threshold?: number;
}

export const SectionCompareBar: React.FC<SectionCompareBarProps> = ({
  data,
  threshold = 75,
}) => {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xl text-xs space-y-1">
          <p className="font-bold text-slate-900">{d.name} {d.code ? `(${d.code})` : ''}</p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Attendance:</span>
            <span className={`font-bold tabular-nums ${d.attendancePercentage >= threshold ? 'text-emerald-600' : 'text-rose-600'}`}>
              {d.attendancePercentage}%
            </span>
          </div>
          {d.totalPeriods !== undefined && (
            <p className="text-[11px] text-slate-500">Classes: {d.totalPeriods}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => (val.length > 12 ? `${val.slice(0, 10)}...` : val)}
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
          <ReferenceLine
            y={threshold}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: `Threshold ${threshold}%`,
              position: 'insideTopRight',
              fill: '#D97706',
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <Bar dataKey="attendancePercentage" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.attendancePercentage >= threshold ? '#3B82F6' : '#EF4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
