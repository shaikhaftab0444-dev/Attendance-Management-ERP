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
  ShieldCheck,
} from 'lucide-react';
import api from '../../lib/api';
import { Department, Subject, Course, Batch, DefaulterRecord, DefaulterResponse } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';

export const AdminDefaulters: React.FC = () => {
  const getInitialDates = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${d}`,
    };
  };

  const initialDates = getInitialDates();
  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [course, setCourse] = useState<string>('');
  const [batch, setBatch] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [year, setYear] = useState<string>('all');
  const [subject, setSubject] = useState<string>('');
  const [mode, setMode] = useState<'subject' | 'overall'>('overall');

  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [data, setData] = useState<DefaulterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Condonation / Waiver State
  const [condoningStudent, setCondoningStudent] = useState<DefaulterRecord | null>(null);
  const [condoneReason, setCondoneReason] = useState<string>('Medical Leave');
  const [isCondoning, setIsCondoning] = useState(false);

  const { showToast } = useToast();

  const fetchDropdowns = async () => {
    try {
      const [crsRes, batchRes, deptRes, subRes] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/batches'),
        api.get('/admin/departments'),
        api.get('/admin/subjects'),
      ]);
      setCourses(crsRes.data);
      setBatches(batchRes.data);
      setDepartments(deptRes.data);
      setSubjects(subRes.data);
    } catch (err: any) {
      console.error('Error fetching filters:', err);
    }
  };

  const fetchDefaulters = async () => {
    try {
      setIsLoading(true);
      const params: any = { startDate, endDate, mode };
      if (course) params.course = course;
      if (batch) params.batch = batch;
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
  }, [startDate, endDate, course, batch, department, year, subject, mode]);

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
    link.setAttribute('download', `attendedge_defaulters_${startDate}_to_${endDate}_${department || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Defaulter list exported to CSV', 'success');
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const handleExportPdf = async () => {
    if (!startDate || !endDate) {
      showToast('Start and end date are required for PDF export.', 'warning');
      return;
    }
    try {
      setIsExportingPdf(true);
      const res = await api.get('/admin/defaulters/export-pdf', {
        params: {
          startDate,
          endDate,
          department: department || undefined,
          course: course || undefined,
          batch: batch || undefined,
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
      link.setAttribute('download', `attendedge_defaulters_${startDate}_to_${endDate}.pdf`);
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

  const handleCondone = async () => {
    if (!condoningStudent) return;
    setIsCondoning(true);
    try {
      const res = await api.post(`/attendance/condone/${condoningStudent.studentId}`, {
        reason: condoneReason,
      });
      showToast(res.data?.message || `Waiver granted for ${condoningStudent.name}`, 'success');
      setCondoningStudent(null);
      setCondoneReason('Medical Leave');
      fetchDefaulters();
    } catch (err: any) {
      showToast(err.customMessage || err.response?.data?.message || 'Failed to grant attendance waiver', 'error');
    } finally {
      setIsCondoning(false);
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
    {
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => {
            setCondoningStudent(row);
            setCondoneReason('Medical Leave');
          }}
          className="p-1.5 px-2.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
          title="Grant Attendance Waiver / Grace"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Condone</span>
        </button>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Start Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Start Date *</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-medium"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>End Date *</span>
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono font-medium"
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
              const newCourse = e.target.value;
              setCourse(newCourse);
              setBatch('');
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

        {/* Cohort Batch Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Cohort Batch</span>
          </label>
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Batches</option>
            {batches
              .filter((b) => !course || (b.course?._id || b.course) === course)
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} {!b.isActive ? '(Archived)' : ''}
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
          subtitle={`Under ${threshold}% (${startDate} to ${endDate})`}
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
              Identified Defaulters for {startDate} to {endDate} ({mode === 'overall' && !subject ? 'Combined Overall' : 'Subject Wise'})
            </h3>
            <p className="text-xs text-slate-500">
              Computed strictly from verified attendance records in MongoDB for the date span {startDate} to {endDate}
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
          emptyDescription={`Great news! Every enrolled student is maintaining attendance above the mandatory ${threshold}% threshold for ${startDate} to ${endDate}.`}
        />
      </div>

      {/* Condonation / Waiver Modal */}
      <Modal
        isOpen={!!condoningStudent}
        onClose={() => !isCondoning && setCondoningStudent(null)}
        title="Grant Attendance Waiver (Condonation)"
        subtitle="Exemption & Grace Attendance Adjustment"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed space-y-1.5">
              <p className="font-semibold text-sm text-emerald-950">
                Grant Attendance Grace for <span className="underline font-bold">{condoningStudent?.name}</span> ({condoningStudent?.rollNumber})
              </p>
              <p>
                This will calculate and award the exact grace attendance periods needed to elevate the student's attendance to the <span className="font-bold">{threshold}%</span> threshold.
              </p>
              <div className="bg-white/90 p-2.5 rounded-lg border border-emerald-200 font-mono text-xs space-y-1">
                <div>Current Record: <span className="font-bold text-slate-900">{condoningStudent ? condoningStudent.present + condoningStudent.late : 0} / {condoningStudent?.totalPeriods || 0}</span> ({condoningStudent?.percentage}%)</div>
                <div>Target Compliance: <span className="font-bold text-emerald-700">{threshold}% ({Math.ceil(((threshold / 100) * (condoningStudent?.totalPeriods || 0)))} attended periods required)</span></div>
                <div>Grace Periods to Add: <span className="font-bold text-blue-700">+{Math.max(1, Math.ceil(((threshold / 100) * (condoningStudent?.totalPeriods || 0))) - (condoningStudent ? condoningStudent.present + condoningStudent.late : 0))} periods</span></div>
              </div>
              <p className="text-[11px] text-emerald-800">
                ✓ Daily lecture audit records and teacher logs remain 100% authentic and uncorrupted.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Reason for Exemption *
            </label>
            <div className="relative">
              <select
                value={condoneReason}
                onChange={(e) => setCondoneReason(e.target.value)}
                disabled={isCondoning}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 max-h-48 overflow-y-auto cursor-pointer"
              >
                <option value="Medical Leave">Medical Leave (Hospitalization / Doctor Certificate)</option>
                <option value="Sports & Athletic Tournament">Sports & Athletic Tournament Representation</option>
                <option value="Official Institutional Duty">Official Institutional Duty / Student Council</option>
                <option value="Academic Conference / Hackathon">Academic Conference / Hackathon Participation</option>
                <option value="Bereavement / Family Emergency">Bereavement / Family Emergency</option>
                <option value="Special Administrative Dean Approval">Special Administrative Dean Approval</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isCondoning}
              onClick={() => setCondoningStudent(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isCondoning || !condoningStudent}
              onClick={handleCondone}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isCondoning && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isCondoning ? 'Granting Waiver...' : 'Confirm Waiver'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
