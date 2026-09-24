import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface TodaySplitDonutProps {
  present: number;
  late: number;
  absent: number;
  total?: number;
}

export const TodaySplitDonut: React.FC<TodaySplitDonutProps> = ({
  present,
  late,
  absent,
}) => {
  const data = [
    { name: 'Present', value: present, color: '#10B981' }, // emerald-500
    { name: 'Late', value: late, color: '#F59E0B' },       // amber-500
    { name: 'Absent', value: absent, color: '#EF4444' },   // rose-500
  ].filter((item) => item.value > 0);

  const total = present + late + absent;
  const percentage = total > 0 ? (((present + late) / total) * 100).toFixed(1) : '0';

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xl text-xs space-y-0.5">
          <p className="font-bold text-slate-900">{data.name}</p>
          <p className="text-slate-600">
            {data.value} students ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full h-56 flex items-center justify-center">
      {total > 0 ? (
        <>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{percentage}%</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attendance</span>
          </div>
        </>
      ) : (
        <div className="text-center text-slate-400 text-xs">No records available for today</div>
      )}
    </div>
  );
};
