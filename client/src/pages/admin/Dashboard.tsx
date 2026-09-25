import React, { useEffect, useState } from 'react';
import {
  Users,
  GraduationCap,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle2,
  Activity,
  Layers,
} from 'lucide-react';
import api from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { SectionCompareBar } from '../../components/charts/SectionCompareBar';
import { TodaySplitDonut } from '../../components/charts/TodaySplitDonut';
import { formatDateTime } from '../../lib/utils';
import { DepartmentYearMatrixItem } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGlobalReports = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/reports/global');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching global reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalReports();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 border border-slate-200/60" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-100 border border-slate-200/60" />
          <div className="h-80 rounded-2xl bg-slate-100 border border-slate-200/60" />
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const attendanceTrend = data?.attendanceTrend || [];
  const departmentComparison = data?.departmentComparison || [];
  const departmentYearMatrix: DepartmentYearMatrixItem[] = data?.departmentYearMatrix || [];
  const recentActivity = data?.recentActivity || [];

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Overall Attendance"
          value={`${summary.globalAttendancePercentage || 0}%`}
          subtitle={`Threshold target: ${summary.thresholdPercent || 75}%`}
          icon={TrendingUp}
          accentColor={
            (summary.globalAttendancePercentage || 0) >= (summary.thresholdPercent || 75)
              ? 'emerald'
              : 'rose'
          }
          trend={{
            value: `${summary.totalSessionsConducted || 0} classes held`,
            isPositive: true,
          }}
        />
        <StatCard
          title="Active Students"
          value={summary.totalStudents || 0}
          subtitle="Enrolled across sections"
          icon={GraduationCap}
          accentColor="indigo"
        />
        <StatCard
          title="Teaching Staff"
          value={summary.totalTeachers || 0}
          subtitle="Active faculty members"
          icon={Users}
          accentColor="cyan"
        />
        <StatCard
          title="Academic Departments"
          value={summary.totalDepartments || 0}
          subtitle="Faculties & divisions"
          icon={Building2}
          accentColor="amber"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 30-Day Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Institution Attendance Trend</h3>
              <p className="text-xs text-slate-500">30-day aggregate student presence rate</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-600 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              <Activity className="w-4 h-4" />
              <span>Realtime Analysis</span>
            </div>
          </div>
          <AttendanceTrendChart
            data={attendanceTrend}
            threshold={summary.thresholdPercent || 75}
          />
        </div>

        {/* Attendance Distribution Donut */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Historical Presence Split</h3>
            <p className="text-xs text-slate-500 mb-2">Total verified session records</p>
          </div>
          <TodaySplitDonut
            present={summary.globalPresent || 0}
            late={summary.globalLate || 0}
            absent={summary.globalAbsent || 0}
          />
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs">
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Present</p>
              <p className="font-bold text-emerald-600 tabular-nums">{summary.globalPresent || 0}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Late</p>
              <p className="font-bold text-amber-600 tabular-nums">{summary.globalLate || 0}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Absent</p>
              <p className="font-bold text-rose-600 tabular-nums">{summary.globalAbsent || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Department x Year Breakdown Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Department × Academic Year Student Distribution</span>
            </h3>
            <p className="text-xs text-slate-500">
              Live aggregation query grouping active enrolled students by department and year
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Total Enrolled: <span className="text-slate-900 font-bold tabular-nums">{summary.totalStudents || 0}</span>
          </span>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-full text-left text-xs md:text-sm border-collapse">
            <thead className="bg-slate-50 text-[11px] md:text-xs uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold whitespace-nowrap">Academic Department</th>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-center whitespace-nowrap">1st Year</th>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-center whitespace-nowrap">2nd Year</th>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-center whitespace-nowrap">3rd Year</th>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-center whitespace-nowrap">4th Year</th>
                <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-right whitespace-nowrap">Dept Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departmentYearMatrix.map((row) => (
                <tr key={row.departmentId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">
                        {row.code}
                      </span>
                      <span className="font-semibold text-slate-800">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 text-center tabular-nums whitespace-nowrap">
                    <span className={row.year1 > 0 ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                      {row.year1}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 text-center tabular-nums whitespace-nowrap">
                    <span className={row.year2 > 0 ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                      {row.year2}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 text-center tabular-nums whitespace-nowrap">
                    <span className={row.year3 > 0 ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                      {row.year3}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 text-center tabular-nums whitespace-nowrap">
                    <span className={row.year4 > 0 ? 'text-slate-800 font-semibold' : 'text-slate-400'}>
                      {row.year4}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 md:py-3.5 md:px-4 text-right tabular-nums font-bold text-blue-600 whitespace-nowrap">
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Comparison & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Comparison */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Department Performance</h3>
              <p className="text-xs text-slate-500">Attendance comparison across faculties</p>
            </div>
          </div>
          <SectionCompareBar
            data={departmentComparison}
            threshold={summary.thresholdPercent || 75}
          />
        </div>

        {/* Recent Attendance Feed */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Attendance Submissions</h3>
              <p className="text-xs text-slate-500">Live feed of verified submissions</p>
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Latest
            </span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {recentActivity.length > 0 ? (
              recentActivity.map((act: any) => {
                const present = act.records?.filter((r: any) => r.status === 'present').length || 0;
                const total = act.records?.length || 0;
                return (
                  <div
                    key={act._id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/70 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {act.subject?.name || 'Subject'}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            ({act.section?.name || 'Section'})
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Marked by <span className="text-slate-700 font-semibold">{act.teacher?.name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-emerald-600 tabular-nums">
                        {present}/{total} Present
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDateTime(act.markedAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                No attendance submissions recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
