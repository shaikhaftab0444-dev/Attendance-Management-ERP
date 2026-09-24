import React, { useEffect, useState } from 'react';
import {
  UserX,
  Calendar,
  BookOpen,
  Download,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import api from '../../lib/api';
import { TeacherSubjectAssignment, DefaulterRecord, DefaulterResponse } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const TeacherDefaulters: React.FC = () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [month, setMonth] = useState<string>(currentMonth);
  const [subject, setSubject] = useState<string>('');

  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [data, setData] = useState<DefaulterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();

  const fetchMySubjects = async () => {
    try {
      const res = await api.get('/teacher/subjects');
      setAssignments(res.data);
      if (res.data[0]?.subject?._id) {
        setSubject(res.data[0].subject._id);
      }
    } catch (err: any) {
      console.error('Error fetching teacher subjects:', err);
    }
  };

  const fetchDefaulters = async () => {
    if (!subject) return;
    try {
      setIsLoading(true);
      const res = await api.get('/teacher/defaulters', {
        params: { month, subject },
      });
      setData(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error calculating subject defaulters', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMySubjects();
  }, []);

  useEffect(() => {
    if (subject) {
      fetchDefaulters();
    }
  }, [month, subject]);

  // Extract distinct subjects
  const distinctSubjects = Array.from(
    new Map(assignments.map((a) => [a.subject?._id, a.subject])).values()
  ).filter(Boolean);

  const handleExportCsv = () => {
    if (!data || data.defaulters.length === 0) {
      showToast('No defaulter data to export.', 'warning');
      return;
    }

    const headers = ['Roll Number', 'Student Name', 'Section', 'Subject', 'Total Periods', 'Present', 'Late', 'Absent', 'Attendance %'];
    const rows = data.defaulters.map((d) => [
      d.rollNumber,
      `"${d.name.replace(/"/g, '""')}"`,
      d.section,
      `"${d.subject.replace(/"/g, '""')}"`,
      d.totalPeriods,
      d.present,
      d.late,
      d.absent,
      `${d.percentage}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `subject_defaulters_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Subject defaulters exported to CSV', 'success');
  };

  const columns: Column<DefaulterRecord>[] = [
    {
      header: 'Roll No',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-700 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
          {row.rollNumber}
        </span>
      ),
    },
    {
      header: 'Student Name',
      render: (row) => <span className="font-semibold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Class Section',
      accessor: (row) => row.section,
      className: 'text-xs text-slate-600 font-medium',
    },
    {
      header: 'Total Classes',
      accessor: (row) => row.totalPeriods,
      className: 'tabular-nums text-xs text-slate-600',
    },
    {
      header: 'Present',
      accessor: (row) => row.present,
      className: 'tabular-nums text-xs text-emerald-600 font-medium',
    },
    {
      header: 'Late',
      accessor: (row) => row.late,
      className: 'tabular-nums text-xs text-amber-600 font-medium',
    },
    {
      header: 'Absent',
      accessor: (row) => row.absent,
      className: 'tabular-nums text-xs text-rose-600 font-medium',
    },
    {
      header: 'Attendance %',
      render: (row) => (
        <span className="inline-flex items-center justify-center font-bold px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 tabular-nums">
          {row.percentage}%
        </span>
      ),
    },
  ];

  const stats = data?.stats || { totalDefaulters: 0, avgPercentage: 0, worstPercentage: 0, worstStudent: 'None' };
  const threshold = data?.threshold || 75;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserX className="w-5 h-5 text-rose-600" />
            <span>Subject Defaulter Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monthly defaulters for your classes with attendance below {threshold}%
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={!data || data.defaulters.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all w-fit shrink-0"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>Export CSV</span>
          </button>
          <ImportExportBar
            entityName="Subject Defaulters"
            pdfExportUrl="/teacher/defaulters/export-pdf"
            pdfFilename={`Subject_Defaulters_${month}.pdf`}
            queryParams={{ month, ...(subject ? { subject } : {}) }}
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-2xl">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600" />
            <span>Select Month *</span>
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
            <span>Select Subject *</span>
          </label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-teal-500"
          >
            {distinctSubjects.map((s: any) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Subject Defaulters"
          value={stats.totalDefaulters}
          subtitle={`Under ${threshold}% in ${month}`}
          icon={UserX}
          accentColor={stats.totalDefaulters > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Average Defaulter %"
          value={`${stats.avgPercentage}%`}
          subtitle="Mean attendance of defaulters"
          icon={TrendingDown}
          accentColor="amber"
        />
        <StatCard
          title="Lowest Attendance Student"
          value={`${stats.worstPercentage}%`}
          subtitle={stats.worstStudent}
          icon={AlertTriangle}
          accentColor="rose"
        />
      </div>

      {/* Defaulter Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">
              Defaulter List for {month}
            </h3>
            <p className="text-xs text-slate-500">
              Students needing attendance recovery in your course
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-semibold tabular-nums">
            {stats.totalDefaulters} Flagged
          </span>
        </div>

        <DataTable
          columns={columns}
          data={data?.defaulters || []}
          isLoading={isLoading}
          searchPlaceholder="Search students by name or roll number..."
          searchFilter={(row, q) =>
            row.name.toLowerCase().includes(q) ||
            row.rollNumber.toLowerCase().includes(q) ||
            row.section.toLowerCase().includes(q)
          }
          emptyTitle="No defaulters in this subject"
          emptyDescription={`Great! Every student enrolled in this subject has >= ${threshold}% attendance for ${month}.`}
        />
      </div>
    </div>
  );
};
