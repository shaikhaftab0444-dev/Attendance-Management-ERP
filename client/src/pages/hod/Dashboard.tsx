import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  TrendingUp,
  AlertTriangle,
  CalendarDays,
  Building2,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { TodaySplitDonut } from '../../components/charts/TodaySplitDonut';
import { useAuth } from '../../context/AuthContext';

export const HodDashboard: React.FC = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<any>(null);
  const [lowAttendanceData, setLowAttendanceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatYearLabel = (y?: number) => {
    if (!y) return 'All Years';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [repRes, lowRes] = await Promise.all([
        api.get('/hod/reports/department'),
        api.get('/hod/reports/low-attendance'),
      ]);
      setReportData(repRes.data);
      setLowAttendanceData(lowRes.data);
    } catch (err) {
      console.error('Error fetching HOD dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-white border border-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  const overallPct = reportData?.overallPercentage || 0;
  const threshold = reportData?.thresholdPercent || 75;
  const lowCount = lowAttendanceData?.totalFlagged || 0;
  const deptBreakdown = reportData?.departmentBreakdown || [];

  const courseName =
    typeof user?.course === 'object' && user?.course
      ? user.course.name || user.course.code
      : '';

  return (
    <div className="space-y-6">
      {/* Year Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold mb-2 border border-purple-200">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>{courseName ? `${courseName} · ` : ''}{formatYearLabel(user?.year)} Head of Department Oversight</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {courseName ? `${courseName} — ` : ''}{formatYearLabel(user?.year)} Academic Year Overview
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-xl">
              Cross-department management across all class sections, course subjects, and assigned instructors in {courseName ? `${courseName} ` : ''}{formatYearLabel(user?.year)}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/hod/timetable"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-purple-500/20 text-white"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Timetable Schedule</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Year Attendance"
          value={`${overallPct}%`}
          subtitle={`Required threshold: ${threshold}%`}
          icon={TrendingUp}
          accentColor={overallPct >= threshold ? 'emerald' : 'rose'}
          trend={{
            value: `${reportData?.totalSessionsConducted || 0} Lectures`,
            isPositive: true,
          }}
        />
        <StatCard
          title="Total Students"
          value={reportData?.totalStudents || 0}
          subtitle={`Enrolled in ${formatYearLabel(user?.year)}`}
          icon={GraduationCap}
          accentColor="indigo"
        />
        <StatCard
          title="Class Sections"
          value={reportData?.totalSections || 0}
          subtitle="Across all departments"
          icon={Layers}
          accentColor="cyan"
        />
        <StatCard
          title="Low Attendance Flags"
          value={lowCount}
          subtitle={`Students below ${threshold}%`}
          icon={AlertTriangle}
          accentColor={lowCount > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Low Attendance Warning Alert */}
      {lowCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900">
                Attendance Deficit Alert: {lowCount} student(s) in {formatYearLabel(user?.year)} below {threshold}%
              </p>
              <p className="text-xs text-rose-700">
                Intervention required. Review student breakdown across departments.
              </p>
            </div>
          </div>
          <Link
            to="/hod/reports"
            className="px-3.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors w-fit shrink-0 shadow-sm"
          >
            <span>Inspect List</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Per-Department Breakdown Grid for this Year */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" />
              <span>Department Breakdown ({formatYearLabel(user?.year)})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Attendance and enrolment statistics compared across all academic departments in {formatYearLabel(user?.year)}
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Departments Active: <strong className="text-slate-900 font-bold">{deptBreakdown.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deptBreakdown.map((dept: any) => (
            <div
              key={dept.departmentId}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all group flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono font-bold text-blue-700">
                    {dept.code}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      dept.attendancePercentage >= threshold
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {dept.attendancePercentage}% Attendance
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                  {dept.name}
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/60 text-center">
                <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Students</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{dept.studentCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Sections</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{dept.sectionCount}</p>
                </div>
                <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Faculty</p>
                  <p className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{dept.teacherCount}</p>
                </div>
              </div>
            </div>
          ))}

          {deptBreakdown.length === 0 && (
            <div className="col-span-full p-8 text-center text-slate-400 text-xs">
              No sections or students found in {formatYearLabel(user?.year)} yet.
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">30-Day Attendance Trend</h3>
              <p className="text-xs text-slate-500">Aggregated daily attendance fluctuation for {formatYearLabel(user?.year)}</p>
            </div>
          </div>
          <AttendanceTrendChart
            data={reportData?.attendanceTrend || []}
            threshold={threshold}
          />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Presence Distribution</h3>
            <p className="text-xs text-slate-500 mb-2">Total marks recorded in {formatYearLabel(user?.year)}</p>
          </div>
          <TodaySplitDonut
            present={reportData?.totalPresent || 0}
            late={reportData?.totalLate || 0}
            absent={reportData?.totalAbsent || 0}
          />
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-center text-xs">
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Present</p>
              <p className="font-bold text-emerald-600 tabular-nums">{reportData?.totalPresent || 0}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Late</p>
              <p className="font-bold text-amber-600 tabular-nums">{reportData?.totalLate || 0}</p>
            </div>
            <div>
              <p className="text-slate-500 text-[11px] font-medium">Absent</p>
              <p className="font-bold text-rose-600 tabular-nums">{reportData?.totalAbsent || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
