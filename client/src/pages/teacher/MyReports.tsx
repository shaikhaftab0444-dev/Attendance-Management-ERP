import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  CheckCircle2,
  BookOpen,
  Layers,
  Calendar,
  Clock,
} from 'lucide-react';
import api from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { DataTable, Column } from '../../components/ui/DataTable';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { formatDate, formatDateTime } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';

export const TeacherMyReports: React.FC = () => {
  const [reportsData, setReportsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/teacher/reports/my-subjects');
        setReportsData(res.data);
      } catch (err: any) {
        showToast(err.customMessage || 'Error fetching performance reports', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, []);

  const summary = reportsData?.summary || {};
  const breakdown = reportsData?.breakdown || [];
  const recentLogs = reportsData?.recentLogs || [];

  const logColumns: Column<any>[] = [
    {
      header: 'Lecture Date',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-teal-600" />
          <span className="font-semibold text-slate-900">{formatDate(row.date)}</span>
        </div>
      ),
    },
    {
      header: 'Subject & Section',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{row.subject?.name}</p>
          <p className="text-xs text-slate-500 font-mono">
            {row.subject?.code} · {row.section?.name}
          </p>
        </div>
      ),
    },
    {
      header: 'Attendance Record',
      render: (row) => {
        const present = row.records?.filter((r: any) => r.status === 'present').length || 0;
        const late = row.records?.filter((r: any) => r.status === 'late').length || 0;
        const absent = row.records?.filter((r: any) => r.status === 'absent').length || 0;
        const total = row.records?.length || 0;
        const pct = total > 0 ? (((present + late) / total) * 100).toFixed(1) : 0;
        return (
          <div>
            <div className="text-xs space-x-1 tabular-nums font-semibold">
              <span className="text-emerald-600">{present} Present</span> ·{' '}
              <span className="text-amber-600">{late} Late</span> ·{' '}
              <span className="text-rose-600">{absent} Absent</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">{pct}% Attendance</p>
          </div>
        );
      },
    },
    {
      header: 'Submitted At',
      render: (row) => (
        <span className="text-xs text-slate-500 tabular-nums">
          {formatDateTime(row.markedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">My Teaching Performance & Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Classroom attendance performance across your assigned subjects</p>
        </div>
        <ImportExportBar
          entityName="Teaching Reports"
          pdfExportUrl="/teacher/reports/export-pdf"
          pdfFilename="My_Teaching_Reports.pdf"
        />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Overall Attendance Rate"
          value={`${summary.overallPercentage || 0}%`}
          subtitle={`Department Goal: ${summary.thresholdPercent || 75}%`}
          icon={TrendingUp}
          accentColor={
            (summary.overallPercentage || 0) >= (summary.thresholdPercent || 75)
              ? 'emerald'
              : 'amber'
          }
        />
        <StatCard
          title="Total Sessions Held"
          value={summary.totalClassesConducted || 0}
          subtitle="Classes conducted so far"
          icon={CheckCircle2}
          accentColor="indigo"
        />
        <StatCard
          title="Assigned Subjects"
          value={breakdown.length}
          subtitle="Course allocations"
          icon={BookOpen}
          accentColor="cyan"
        />
      </div>

      {/* Subject & Section Breakdown Grid */}
      <div>
        <h3 className="font-semibold text-slate-900 text-base mb-3">Course Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {breakdown.map((item: any, idx: number) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-teal-800 font-semibold px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                    {item.subject?.code}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {item.section?.name}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm">{item.subject?.name}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {item.totalPeriodsHeld} Lectures Conducted
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Average Attendance</span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    item.attendancePercentage >= (summary.thresholdPercent || 75)
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}
                >
                  {item.attendancePercentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions Log Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-semibold text-slate-900 text-base mb-1">Recent Attendance Logs</h3>
        <p className="text-xs text-slate-500 mb-4">Historical verified submissions logged by you</p>
        <DataTable columns={logColumns} data={recentLogs} isLoading={isLoading} />
      </div>
    </div>
  );
};
