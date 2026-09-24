import React, { useEffect, useState } from 'react';
import {
  UserX,
  Calendar,
  BookOpen,
  Download,
  AlertTriangle,
  TrendingDown,
  Building2,
} from 'lucide-react';
import api from '../../lib/api';
import { Subject, DefaulterRecord, DefaulterResponse, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodDefaulters: React.FC = () => {
  const { user } = useAuth();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [month, setMonth] = useState<string>(currentMonth);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [subject, setSubject] = useState<string>('');
  const [mode, setMode] = useState<'subject' | 'overall'>('overall');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<DefaulterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();

  const formatYearLabel = (y?: number) => {
    if (!y) return '1st Year';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const fetchDropdownData = async () => {
    try {
      const [subRes, deptRes] = await Promise.all([
        api.get('/hod/subjects'),
        api.get('/hod/departments'),
      ]);
      setSubjects(subRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  const fetchDefaulters = async () => {
    try {
      setIsLoading(true);
      const params: any = { month, mode };
      if (deptFilter !== 'all') params.department = deptFilter;
      if (subject) params.subject = subject;

      const res = await api.get('/hod/defaulters', { params });
      setData(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching defaulters report', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    fetchDefaulters();
  }, [month, deptFilter, subject, mode]);

  const handleExportCsv = () => {
    if (!data || data.defaulters.length === 0) {
      showToast('No defaulter data to export.', 'warning');
      return;
    }

    const headers = ['Roll Number', 'Student Name', 'Section', 'Year', 'Subject / Scope', 'Total Periods', 'Present', 'Late', 'Absent', 'Attendance %'];
    const rows = data.defaulters.map((d) => [
      d.rollNumber,
      `"${d.name.replace(/"/g, '""')}"`,
      d.section,
      `${d.year || user?.year || 1} Year`,
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
    link.setAttribute('download', `year_${user?.year || 1}_defaulters_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Defaulters exported to CSV', 'success');
  };

  const columns: Column<DefaulterRecord>[] = [
    {
      header: 'Roll No',
      render: (row) => (
        <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
          {row.rollNumber}
        </span>
      ),
    },
    {
      header: 'Student Name',
      render: (row) => <span className="font-semibold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Section',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.section}
        </span>
      ),
    },
    {
      header: 'Subject / Scope',
      render: (row) => (
        <span className="text-xs text-purple-700 font-semibold">
          {row.subject}
        </span>
      ),
    },
    {
      header: 'Total Periods',
      accessor: (row) => row.totalPeriods,
      className: 'tabular-nums text-xs text-slate-700 font-medium',
    },
    {
      header: 'Present',
      accessor: (row) => row.present,
      className: 'tabular-nums text-xs text-emerald-600 font-bold',
    },
    {
      header: 'Late',
      accessor: (row) => row.late,
      className: 'tabular-nums text-xs text-amber-600 font-bold',
    },
    {
      header: 'Absent',
      accessor: (row) => row.absent,
      className: 'tabular-nums text-xs text-rose-600 font-bold',
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
            <span>{formatYearLabel(user?.year)} Defaulters Tracking</span>
          </h2>
          <p className="text-xs text-slate-500">
            Monthly calculated attendance compliance across all departments in {formatYearLabel(user?.year)} (<span className="text-rose-600 font-semibold">&lt; {threshold}%</span>)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportCsv}
            disabled={!data || data.defaulters.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all w-fit shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>Export CSV</span>
          </button>
          <ImportExportBar
            entityName="Defaulters Report"
            pdfExportUrl="/hod/defaulters/export-pdf"
            pdfFilename={`Year_${user?.year || 1}_Defaulters_${month}.pdf`}
            queryParams={{
              month,
              mode,
              ...(deptFilter !== 'all' ? { department: deptFilter } : {}),
              ...(subject ? { subject } : {}),
            }}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Month */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Select Month *</span>
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-medium"
          />
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Department Filter</span>
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Course Subject</span>
          </label>
          <select
            value={subject}
            onChange={(e) => {
              const val = e.target.value;
              setSubject(val);
              if (val) setMode('subject');
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Subjects (Optional)</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Scope Mode
          </label>
          <div className="flex items-center p-1 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('overall');
                setSubject('');
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all ${
                mode === 'overall' && !subject
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setMode('subject')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all ${
                mode === 'subject' || subject
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Per-Subject
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Year Defaulters"
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
            <h3 className="font-bold text-slate-900 text-base">
              {formatYearLabel(user?.year)} Defaulter Records for {month}
            </h3>
            <p className="text-xs text-slate-500">
              Students in {formatYearLabel(user?.year)} falling below the {threshold}% minimum lecture attendance policy
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold tabular-nums">
            {stats.totalDefaulters} Students
          </span>
        </div>

        <DataTable
          columns={columns}
          data={data?.defaulters || []}
          isLoading={isLoading}
          searchPlaceholder="Search defaulters by name, roll number, or section..."
          searchFilter={(row, q) =>
            row.name.toLowerCase().includes(q) ||
            row.rollNumber.toLowerCase().includes(q) ||
            row.section.toLowerCase().includes(q)
          }
          emptyTitle="No defaulters for this period"
          emptyDescription={`All students in ${formatYearLabel(user?.year)} have attended >= ${threshold}% of classes for ${month}.`}
        />
      </div>
    </div>
  );
};
