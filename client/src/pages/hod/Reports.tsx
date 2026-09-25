import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Layers,
} from 'lucide-react';
import api from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { AttendanceTrendChart } from '../../components/charts/AttendanceTrendChart';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Department, Batch } from '../../types';

export const HodReports: React.FC = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<any>(null);
  const [lowAttendanceData, setLowAttendanceData] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Drilldown modal for student subjectwise attendance
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const { showToast } = useToast();

  const formatYearLabel = (y?: number) => {
    if (!y) return '1st Year';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (deptFilter !== 'all') params.department = deptFilter;
      if (batchFilter !== 'all') params.batch = batchFilter;

      const [repRes, lowRes, deptRes, batchRes] = await Promise.all([
        api.get('/hod/reports/department', { params }),
        api.get('/hod/reports/low-attendance', { params }),
        api.get('/hod/departments'),
        api.get('/hod/batches'),
      ]);
      setReportData(repRes.data);
      setLowAttendanceData(lowRes.data);
      setDepartments(deptRes.data);
      setBatches(batchRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching reports', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptFilter, batchFilter]);

  const overallPct = reportData?.overallPercentage || 0;
  const threshold = reportData?.thresholdPercent || 75;
  const teacherCompliance = reportData?.teacherCompliance || [];
  const lowStudents = lowAttendanceData?.students || [];
  const departmentBreakdown = reportData?.departmentBreakdown || [];

  const teacherColumns: Column<any>[] = [
    {
      header: 'Faculty Instructor',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email}</p>
        </div>
      ),
    },
    {
      header: 'Weekly Scheduled',
      accessor: (row) => `${row.scheduledWeekly} Classes`,
      className: 'text-xs text-slate-700 font-semibold tabular-nums',
    },
    {
      header: 'Marked This Week',
      accessor: (row) => `${row.markedThisWeek} Marked`,
      className: 'text-xs text-slate-700 font-semibold tabular-nums',
    },
    {
      header: 'Compliance Rate',
      render: (row) => {
        const pass = row.complianceRate >= 90;
        return (
          <span
            className={`font-bold tabular-nums px-2.5 py-0.5 rounded-full text-xs ${
              pass
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : row.complianceRate >= 60
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {row.complianceRate}%
          </span>
        );
      },
    },
    {
      header: 'Avg Class Attendance',
      accessor: (row) => `${row.avgAttendanceRate}%`,
      className: 'text-xs text-slate-900 font-bold tabular-nums',
    },
  ];

  const lowStudentColumns: Column<any>[] = [
    {
      header: 'Roll Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
          {row.rollNumber}
        </span>
      ),
    },
    {
      header: 'Student Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    {
      header: 'Section & Dept',
      render: (row) => (
        <span className="text-xs text-slate-700 font-semibold">
          {row.section} {row.department && `(${row.department})`}
        </span>
      ),
    },
    {
      header: 'Classes Held',
      accessor: (row) => row.totalClasses,
      className: 'text-xs text-slate-700 tabular-nums font-medium',
    },
    {
      header: 'Attended (P+L)',
      accessor: (row) => `${row.present + row.late} / ${row.totalClasses}`,
      className: 'text-xs text-slate-700 tabular-nums font-semibold',
    },
    {
      header: 'Attendance %',
      render: (row) => (
        <span className="font-bold text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full tabular-nums">
          {row.attendancePercentage}%
        </span>
      ),
    },
    {
      header: `Classes Needed for ${threshold}%`,
      render: (row) => (
        <span className="text-xs font-bold text-amber-700 tabular-nums">
          +{row.deficitClasses} more
        </span>
      ),
    },
    {
      header: 'Action',
      render: (row) => (
        <button
          onClick={() => {
            setSelectedStudent(row);
            setIsDrilldownOpen(true);
          }}
          className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold transition-colors shadow-sm"
        >
          Subject Breakdown
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{formatYearLabel(user?.year)} Attendance Analytics</span>
          </h2>
          <p className="text-xs text-slate-500">
            Comprehensive multi-department compliance reports and low-attendance alerts for {formatYearLabel(user?.year)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <Building2 className="w-4 h-4 text-purple-600" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <Layers className="w-4 h-4 text-indigo-600" />
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Batch Cohorts</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.startYear}-{b.endYear})
                </option>
              ))}
            </select>
          </div>

          <ImportExportBar
            entityName="Department Analytics"
            pdfExportUrl="/hod/reports/export-pdf"
            pdfFilename={`Year_${user?.year || 1}_Analytics_Report.pdf`}
            queryParams={{
              ...(deptFilter !== 'all' ? { department: deptFilter } : {}),
              ...(batchFilter !== 'all' ? { batch: batchFilter } : {}),
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Overall Attendance"
          value={`${overallPct}%`}
          subtitle={`Required Goal: ${threshold}%`}
          icon={TrendingUp}
          accentColor={overallPct >= threshold ? 'emerald' : 'rose'}
        />
        <StatCard
          title="Flagged Low Attendance"
          value={lowStudents.length}
          subtitle={`Students under ${threshold}%`}
          icon={AlertTriangle}
          accentColor={lowStudents.length > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Total Sessions Conducted"
          value={reportData?.totalSessionsConducted || 0}
          subtitle={`${formatYearLabel(user?.year)} classes held`}
          icon={CheckCircle2}
          accentColor="cyan"
        />
      </div>

      {/* Department Breakdown Grid if multiple departments */}
      {departmentBreakdown.length > 0 && deptFilter === 'all' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-900 text-base mb-1">
            Department Performance Breakdown ({formatYearLabel(user?.year)})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Comparison of overall student attendance across departments in your year
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentBreakdown.map((dept: any) => {
              const pass = dept.overallPercentage >= threshold;
              return (
                <div
                  key={dept.departmentId}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-purple-300 transition-all space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{dept.departmentName}</h4>
                      <p className="text-xs text-purple-700 font-mono font-bold">{dept.departmentCode}</p>
                    </div>
                    <span
                      className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                        pass
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {dept.overallPercentage}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/60 font-medium">
                    <span>{dept.studentCount} Students</span>
                    <span>{dept.sectionCount} Sections</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 30-Day Trend */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-1">
          30-Day {formatYearLabel(user?.year)} Attendance Trend
        </h3>
        <p className="text-xs text-slate-500 mb-4">Daily attendance movements across all year sections</p>
        <AttendanceTrendChart data={reportData?.attendanceTrend || []} threshold={threshold} />
      </div>

      {/* Low Attendance Student Registry */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span className="text-rose-600">Critical:</span> Students Below {threshold}% Mandatory Threshold
            </h3>
            <p className="text-xs text-slate-500">
              Ranked ascending by attendance percentage. Immediate notice recommended.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold tabular-nums">
            {lowStudents.length} Students At Risk
          </span>
        </div>

        <DataTable
          columns={lowStudentColumns}
          data={lowStudents}
          isLoading={isLoading}
          emptyTitle="No At-Risk Students"
          emptyDescription={`All ${formatYearLabel(user?.year)} students currently meet the attendance requirement!`}
        />
      </div>

      {/* Teacher Marking Compliance */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-1">Faculty Weekly Timetable Compliance</h3>
        <p className="text-xs text-slate-500 mb-4">
          Tracking whether instructors are diligently logging attendance for all scheduled weekly slots in {formatYearLabel(user?.year)}
        </p>
        <DataTable columns={teacherColumns} data={teacherCompliance} isLoading={isLoading} />
      </div>

      {/* Subject Breakdown Drilldown Modal */}
      <Modal
        isOpen={isDrilldownOpen}
        onClose={() => setIsDrilldownOpen(false)}
        title={`Subject Breakdown: ${selectedStudent?.name}`}
        subtitle={`Roll: ${selectedStudent?.rollNumber} · Section: ${selectedStudent?.section}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Overall Attendance:</span>
            <span className="font-bold text-rose-600 tabular-nums">
              {selectedStudent?.attendancePercentage}%
            </span>
          </div>

          <div className="w-full md:rounded-xl md:border md:border-slate-200 md:bg-white md:overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse block md:table">
              <thead className="hidden md:table-header-group bg-slate-50 text-slate-700 uppercase tracking-wider border-b border-slate-200 text-[11px] md:text-xs font-bold">
                <tr className="md:table-row">
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Subject Name</th>
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Total Classes</th>
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Present</th>
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Late</th>
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Absent</th>
                  <th className="py-2.5 px-3 md:py-3 md:px-4 whitespace-nowrap">Subject %</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group space-y-2.5 md:space-y-0 divide-y-0 md:divide-y md:divide-slate-100">
                {selectedStudent?.subjectWise?.map((sw: any, idx: number) => (
                  <tr key={idx} className="block bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 md:space-y-0 md:bg-transparent md:border-0 md:p-0 md:table-row hover:bg-slate-50/60 transition-colors">
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 font-semibold text-slate-900">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Subject</span>
                      <span>{sw.name}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 tabular-nums text-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Classes</span>
                      <span>{sw.total}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 tabular-nums text-emerald-600 font-bold">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Present</span>
                      <span>{sw.present}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 tabular-nums text-amber-600 font-bold">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Late</span>
                      <span>{sw.late}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 tabular-nums text-rose-600 font-bold">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Absent</span>
                      <span>{sw.absent}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell py-0 md:py-3 md:px-4 tabular-nums font-bold">
                      <span className="text-[11px] font-bold text-slate-500 uppercase md:hidden">Attendance %</span>
                      <span
                        className={
                          sw.percentage >= threshold ? 'text-emerald-600' : 'text-rose-600'
                        }
                      >
                        {sw.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
