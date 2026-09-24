import React, { useEffect, useState } from 'react';
import { Plus, Calendar, Trash2, CalendarOff, School, Building2, Globe, Layers } from 'lucide-react';
import api from '../../lib/api';
import { Holiday, Course, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminHolidays: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>('');
  const [scopeFilter, setScopeFilter] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayScope, setHolidayScope] = useState<'all' | 'course' | 'department'>('all');
  const [holidayCourse, setHolidayCourse] = useState('');
  const [holidayDept, setHolidayDept] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchDependencies = async () => {
    try {
      const [crsRes, deptRes] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/departments'),
      ]);
      setCourses(crsRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      console.error('Error fetching holiday dependencies:', err);
    }
  };

  const fetchHolidays = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (monthFilter) params.month = monthFilter;
      if (scopeFilter) params.scope = scopeFilter;
      if (courseFilter) params.course = courseFilter;
      if (deptFilter) params.department = deptFilter;

      const res = await api.get('/admin/holidays', { params });
      setHolidays(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching holidays', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [monthFilter, scopeFilter, courseFilter, deptFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName) {
      showToast('Date and holiday name are required.', 'warning');
      return;
    }

    if (holidayScope === 'course' && !holidayCourse) {
      showToast('Please select a course for course-scoped holiday.', 'warning');
      return;
    }

    if (holidayScope === 'department' && !holidayDept) {
      showToast('Please select a department for department-scoped holiday.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/admin/holidays', {
        date: holidayDate,
        name: holidayName,
        scope: holidayScope,
        course: holidayScope === 'course' ? holidayCourse : (holidayScope === 'department' ? (holidayCourse || undefined) : null),
        department: holidayScope === 'department' ? holidayDept : null,
      });
      showToast('Holiday added successfully', 'success');
      setIsModalOpen(false);
      setHolidayDate('');
      setHolidayName('');
      setHolidayScope('all');
      setHolidayCourse('');
      setHolidayDept('');
      fetchHolidays();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to add holiday', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove '${name}' from holidays?`)) {
      return;
    }

    try {
      await api.delete(`/admin/holidays/${id}`);
      showToast('Holiday deleted', 'success');
      fetchHolidays();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete holiday', 'error');
    }
  };

  const openCreateModal = () => {
    setHolidayDate('');
    setHolidayName('');
    setHolidayScope('all');
    const firstCourse = courses[0]?._id || '';
    setHolidayCourse(firstCourse);
    const depts = departments.filter((d) => (d.course?._id || d.course) === firstCourse);
    setHolidayDept(depts[0]?._id || '');
    setIsModalOpen(true);
  };

  const columns: Column<Holiday>[] = [
    {
      header: 'Holiday Date',
      render: (row) => {
        const d = new Date(row.date);
        const formatted = d.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        return (
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 shadow-sm">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="font-mono text-xs font-bold text-slate-800">{formatted}</span>
          </div>
        );
      },
    },
    {
      header: 'Occasion / Name',
      render: (row) => <span className="font-semibold text-slate-900 text-sm">{row.name}</span>,
    },
    {
      header: 'Scope / Applicability',
      render: (row) => {
        const scope = row.scope || 'all';
        if (scope === 'all') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>College-wide (All Courses)</span>
            </span>
          );
        }
        if (scope === 'course') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <School className="w-3.5 h-3.5 text-purple-600" />
              <span>{row.course?.name || row.course?.code || 'Course Specific'}</span>
            </span>
          );
        }
        if (scope === 'department') {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {row.department?.name || row.department?.code || 'Department'}
                {row.department?.course?.code ? ` (${row.department.course.code})` : ''}
              </span>
            </span>
          );
        }
        return null;
      },
    },
    {
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => handleDelete(row._id, row.name)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
          title="Delete Holiday"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
          <span>Remove</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-blue-600" />
            <span>Academic Holidays Management</span>
          </h2>
          <p className="text-xs text-slate-500">
            Configure official holidays (All College, Course-specific, or Department-specific). Attendance marking is automatically suspended on these dates.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Holidays"
            exportUrl={`/admin/holidays/export?${new URLSearchParams({
              ...(monthFilter ? { month: monthFilter } : {}),
              ...(scopeFilter ? { scope: scopeFilter } : {}),
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/holidays/export-pdf?${new URLSearchParams({
              ...(monthFilter ? { month: monthFilter } : {}),
              ...(scopeFilter ? { scope: scopeFilter } : {}),
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
            }).toString()}`}
            pdfFilename="holidays.pdf"
            importUrl="/admin/holidays/import"
            onImportSuccess={fetchHolidays}
            exportFilename="academic_holidays.csv"
          />

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Holiday</span>
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Month Filter</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-mono"
            />
            {monthFilter && (
              <button
                onClick={() => setMonthFilter('')}
                className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 font-medium shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Scope Filter</span>
          </label>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Scopes</option>
            <option value="all">College-wide Only</option>
            <option value="course">Course Specific Only</option>
            <option value="department">Department Specific Only</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-indigo-600" />
            <span>Course Filter</span>
          </label>
          <select
            value={courseFilter}
            onChange={(e) => {
              const newCourse = e.target.value;
              setCourseFilter(newCourse);
              if (newCourse && deptFilter) {
                const dept = departments.find((d) => d._id === deptFilter);
                if (dept && (dept.course?._id || dept.course) !== newCourse) {
                  setDeptFilter('');
                }
              }
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

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Department Filter</span>
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Departments</option>
            {departments
              .filter((d) => !courseFilter || (d.course?._id || d.course) === courseFilter)
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code}) {d.course?.code ? `— ${d.course.code}` : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={holidays}
        isLoading={isLoading}
        searchPlaceholder="Search holidays by occasion..."
        searchFilter={(row, q) => row.name.toLowerCase().includes(q)}
        emptyTitle="No Holidays Configured"
        emptyDescription="No holidays found for this filter. Use '+ Add Holiday' or Import CSV above."
      />

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Academic Holiday"
        subtitle="Specify date, scope, and occasion name to suspend lecture attendance"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Holiday Date *
              </label>
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Holiday / Occasion Name *
              </label>
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="e.g. Independence Day, Diwali, Tech Fest"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Holiday Scope *
            </label>
            <select
              value={holidayScope}
              onChange={(e) => {
                const s = e.target.value as 'all' | 'course' | 'department';
                setHolidayScope(s);
                if (s !== 'all' && !holidayCourse && courses[0]) {
                  setHolidayCourse(courses[0]._id);
                }
              }}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">College-wide (All Courses & Departments)</option>
              <option value="course">Course Specific (e.g. B.Tech Only)</option>
              <option value="department">Department Specific (e.g. CSE Only)</option>
            </select>
          </div>

          {holidayScope === 'course' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>Applicable Course Program *</span>
              </label>
              <select
                value={holidayCourse}
                onChange={(e) => setHolidayCourse(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">Select Course Program...</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {holidayScope === 'department' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Course Program *</span>
                </label>
                <select
                  value={holidayCourse}
                  onChange={(e) => {
                    const cId = e.target.value;
                    setHolidayCourse(cId);
                    const depts = departments.filter((d) => (d.course?._id || d.course) === cId);
                    setHolidayDept(depts[0]?._id || '');
                  }}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option value="">Select Course</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Applicable Department *
                </label>
                <select
                  value={holidayDept}
                  disabled={!holidayCourse}
                  onChange={(e) => setHolidayDept(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">{holidayCourse ? 'Select Department' : 'Select Course First'}</option>
                  {departments
                    .filter((d) => (d.course?._id || d.course) === holidayCourse)
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 text-white shadow-sm"
            >
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>Save Holiday</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

