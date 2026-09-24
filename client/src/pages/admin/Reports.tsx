import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, CheckCircle2, GraduationCap, School, FileText } from 'lucide-react';
import api from '../../lib/api';
import { Course } from '../../types';
import { StatCard } from '../../components/ui/StatCard';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { DataTable, Column } from '../../components/ui/DataTable';
import { useToast } from '../../context/ToastContext';

export const AdminReports: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/admin/courses')
      .then((res) => setCourses(res.data))
      .catch((err) => console.error('Error fetching courses:', err));
  }, []);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (courseFilter !== 'all') params.course = courseFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      const res = await api.get('/admin/reports/global', { params });
      setData(res.data);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [courseFilter, yearFilter]);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const res = await api.get('/admin/reports/export-pdf', {
        params: {
          course: courseFilter !== 'all' ? courseFilter : undefined,
          year: yearFilter !== 'all' ? yearFilter : undefined,
        },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'academic_analytics_report.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Analytics Report PDF downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.customMessage || 'Error exporting analytics PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const summary = data?.summary || {};
  const departmentComparison = data?.departmentComparison || [];
  const attendanceTrend = data?.attendanceTrend || [];

  const columns: Column<any>[] = [
    {
      header: 'Department',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500 font-mono">Code: {row.code} {row.course?.code ? `· ${row.course.code}` : ''}</p>
        </div>
      ),
    },
    {
      header: 'Classes Conducted',
      accessor: (row) => row.totalPeriods || 0,
      className: 'tabular-nums text-xs text-slate-700 font-medium',
    },
    {
      header: 'Present Marks',
      accessor: (row) => row.present || 0,
      className: 'tabular-nums text-xs text-emerald-600 font-bold',
    },
    {
      header: 'Late Marks',
      accessor: (row) => row.late || 0,
      className: 'tabular-nums text-xs text-amber-600 font-bold',
    },
    {
      header: 'Absent Marks',
      accessor: (row) => row.absent || 0,
      className: 'tabular-nums text-xs text-rose-600 font-bold',
    },
    {
      header: 'Attendance %',
      render: (row) => {
        const pct = row.attendancePercentage || 0;
        const pass = pct >= (summary.thresholdPercent || 75);
        return (
          <span
            className={`font-bold tabular-nums px-2.5 py-1 rounded-full text-xs ${
              pass
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {pct}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Global Institution Reports</h2>
          <p className="text-xs text-slate-500">Institutional aggregate statistics and departmental breakdowns</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf || !data}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
          >
            {isExportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-rose-600" />
            )}
            <span>Export Report PDF</span>
          </button>

          {/* Course & Year Filters */}
          <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex-wrap">
            <div className="flex items-center gap-1.5 px-2">
              <School className="w-4 h-4 text-indigo-600" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Courses</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-2 border-l border-slate-200">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Years (1st - 4th)</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Overall Attendance Rate"
          value={`${summary.globalAttendancePercentage || 0}%`}
          subtitle={`Institutional Goal: ${summary.thresholdPercent || 75}%`}
          icon={TrendingUp}
          accentColor={
            (summary.globalAttendancePercentage || 0) >= (summary.thresholdPercent || 75)
              ? 'emerald'
              : 'rose'
          }
        />
        <StatCard
          title="Total Classes Held"
          value={summary.totalSessionsConducted || 0}
          subtitle="All semesters combined"
          icon={CheckCircle2}
          accentColor="indigo"
        />
        <StatCard
          title="Enrolled Students"
          value={summary.totalStudents || 0}
          subtitle="Across all degree programs"
          icon={Users}
          accentColor="cyan"
        />
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-1">30-Day Attendance Movement</h3>
        <p className="text-xs text-slate-500 mb-4">Historical daily attendance percentage</p>
        <AttendanceTrendChart data={attendanceTrend} threshold={summary.thresholdPercent || 75} />
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-1">Departmental Breakdown Table</h3>
        <p className="text-xs text-slate-500 mb-4">Verified attendance metrics per academic department</p>
        <DataTable columns={columns} data={departmentComparison} isLoading={isLoading} />
      </div>
    </div>
  );
};
