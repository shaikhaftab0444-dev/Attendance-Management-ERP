import React, { useEffect, useState, useMemo } from 'react';
import {
  UserX,
  Calendar,
  Building2,
  BookOpen,
  Download,
  FileText,
  AlertTriangle,
  TrendingDown,
  GraduationCap,
  School,
} from 'lucide-react';
import api from '../../lib/api';
import { Department, Subject, Course, DefaulterRecord, DefaulterResponse } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { useToast } from '../../context/ToastContext';

export const AdminDefaulters: React.FC = () => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [month, setMonth] = useState<string>(currentMonth);
  const [course, setCourse] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [year, setYear] = useState<string>('all');
  const [subject, setSubject] = useState<string>('');
  const [mode, setMode] = useState<'subject' | 'overall'>('overall');

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [data, setData] = useState<DefaulterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();

  const fetchDropdowns = async () => {
    try {
      const [crsRes, deptRes, subRes] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/departments'),
        api.get('/admin/subjects'),
      ]);
      setCourses(crsRes.data);
      setDepartments(deptRes.data);
      setSubjects(subRes.data);
    } catch (err: any) {
      console.error('Error fetching filters:', err);
    }
  };

  const fetchDefaulters = async () => {
    try {
      setIsLoading(true);
      const params: any = { month, mode };
      if (course) params.course = course;
      if (department) params.department = department;
      if (year !== 'all') params.year = Number(year);
      if (subject) params.subject = subject;

      const res = await api.get('/admin/defaulters', { params });
      setData(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching defaulters report', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchDefaulters();
  }, [month, course, department, year, subject, mode]);

  const filteredSubjects = useMemo(() => {
    if (!department) return subjects;
    return subjects.filter((s) => {
      const dId = (s.department as any)?._id || s.department;
      return dId === department;
    });
  }, [subjects, department]);

  const handleExportCsv = () => {
    if (!data || data.defaulters.length === 0) {
      showToast('No defaulter data to export.', 'warning');
      return;
    }

    const headers = ['Roll Number', 'Student Name', 'Section', 'Year', 'Subject / Scope', 'Total Periods', 'Present (P+L)', 'Late', 'Absent', 'Attendance %'];
    const rows = data.defaulters.map((d) => [
      d.rollNumber,
      `"${d.name.replace(/"/g, '""')}"`,
      d.section,
      `${d.year || 1} Year`,
      `"${d.subject.replace(/"/g, '""')}"`,
      d.totalPeriods,
      d.present + d.late,
      d.late,
      d.absent,
      `${d.percentage}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendedge_defaulters_${month}_${department || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Defaulter list exported to CSV', 'success');
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    if (!month) {
      showToast('Month is required for PDF export.', 'warning');
      return;
    }
    try {
      setIsExportingPdf(true);
      const res = await api.get('/admin/defaulters/export-pdf', {
        params: {
          month,
          department: department || undefined,
          course: course || undefined,
          year: year !== 'all' ? year : undefined,
          subject: subject || undefined,
          mode,
        },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `attendedge_defaulters_${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Defaulters PDF downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err.customMessage || 'Error exporting defaulters PDF', 'error');
    } finally {
      setIsExportingPdf(false);
    }
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
      header: 'Section & Year',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.section} · Year {row.year || 1}
        </span>
      ),
    },
    {
      header: 'Subject / Scope',
      render: (row) => (
        <span className="text-xs text-blue-700 font-semibold">
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
            <span>Institution Defaulters Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time dynamically calculated defaulter registry for attendance below mandatory {threshold}% threshold
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={!data || data.defaulters.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all w-fit shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={!data || data.defaulters.length === 0 || isExportingPdf}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-rose-50/50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all w-fit shrink-0 shadow-sm"
          >
            {isExportingPdf ? (
              <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-rose-600" />
            )}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Month Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Select Month *</span>
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        {/* Course Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-indigo-600" />
            <span>Course</span>
          </label>
          <select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setSubject('');
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Courses</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Department</span>
          </label>
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSubject('');
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code}) {d.course?.code ? `— ${d.course.code}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Academic Year</span>
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Years (1st - 4th)</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
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
            {filteredSubjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Calculation Scope
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Overall
            </button>
            <button
              type="button"
              onClick={() => setMode('subject')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all ${
                mode === 'subject' || subject
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
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
          title="Total Defaulters"
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
          title="Critical Lowest Student"
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
              Identified Defaulters for {month} ({mode === 'overall' && !subject ? 'Combined Overall' : 'Subject Wise'})
            </h3>
            <p className="text-xs text-slate-500">
              Computed strictly from verified attendance records in MongoDB for the month of {month}
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold tabular-nums">
            {stats.totalDefaulters} Students Debarred/At-Risk
          </span>
        </div>

        <DataTable
          columns={columns}
          data={data?.defaulters || []}
          isLoading={isLoading}
          searchPlaceholder="Search defaulters by student name, roll number, or section..."
          searchFilter={(row, q) =>
            row.name.toLowerCase().includes(q) ||
            row.rollNumber.toLowerCase().includes(q) ||
            row.section.toLowerCase().includes(q) ||
            row.subject.toLowerCase().includes(q)
          }
          emptyTitle="No defaulters for this period"
          emptyDescription={`Great news! Every enrolled student is maintaining attendance above the mandatory ${threshold}% threshold for ${month}.`}
        />
      </div>
    </div>
  );
};
