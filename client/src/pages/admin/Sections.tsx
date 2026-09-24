import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Layers, Building2, RefreshCw, AlertCircle, AlertTriangle, GraduationCap, School, Calendar } from 'lucide-react';
import api from '../../lib/api';
import { Section, Department, Course, AcademicSession, Batch } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminSections: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [modalCourse, setModalCourse] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [modalBatch, setModalBatch] = useState('');
  const [semester, setSemester] = useState(1);
  const [year, setYear] = useState<number>(1);
  const [session, setSession] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (courseFilter) params.course = courseFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      if (deptFilter) params.department = deptFilter;

      const [secRes, deptRes, sesRes, crsRes, bthRes] = await Promise.all([
        api.get('/admin/sections', { params }),
        api.get('/admin/departments'),
        api.get('/admin/sessions'),
        api.get('/admin/courses'),
        api.get('/admin/batches'),
      ]);
      setSections(secRes.data);
      setDepartments(deptRes.data);
      setSessions(sesRes.data);
      setCourses(crsRes.data);
      setBatches(bthRes.data);
      const activeSes = sesRes.data.find((s: any) => s.isActive) || sesRes.data[0];
      if (!session && activeSes) setSession(activeSes._id);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching sections', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseFilter, yearFilter, deptFilter]);

  const openCreateModal = () => {
    setEditingSection(null);
    setName('');
    const firstCourse = courses[0]?._id || '';
    setModalCourse(firstCourse);
    const deptsForCourse = departments.filter((d) => (d.course?._id || d.course) === firstCourse);
    setDepartment(deptsForCourse[0]?._id || '');
    const courseBatches = batches.filter((b) => (b.course?._id || b.course) === firstCourse);
    setModalBatch(courseBatches[0]?._id || '');
    setSemester(1);
    setYear(1);
    setIsModalOpen(true);
  };

  const openEditModal = (sec: Section) => {
    setEditingSection(sec);
    setName(sec.name);
    const deptDoc = (sec.department as any);
    const cId = deptDoc?.course?._id || deptDoc?.course || '';
    setModalCourse(cId);
    setDepartment(deptDoc?._id || sec.department);
    setModalBatch((sec.batch as any)?._id || sec.batch || '');
    setSemester(sec.semester);
    setYear(sec.year || Math.min(4, Math.max(1, Math.ceil(sec.semester / 2))));
    setSession((sec.session as any)?._id || sec.session);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !department || !semester || !year || !session) {
      showToast('Please fill all mandatory fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSection) {
        await api.patch(`/admin/sections/${editingSection._id}`, {
          name,
          department,
          semester: Number(semester),
          year: Number(year),
          session,
          batch: modalBatch || undefined,
        });
        showToast('Section updated successfully', 'success');
      } else {
        await api.post('/admin/sections', {
          name,
          department,
          semester: Number(semester),
          year: Number(year),
          session,
          batch: modalBatch || undefined,
        });
        showToast('Section created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save section', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackfillYears = async () => {
    setIsBackfilling(true);
    try {
      const res = await api.post('/admin/backfill-years');
      showToast(res.data.message || 'Year backfill completed!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Backfill failed', 'error');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleBackfillBatches = async () => {
    setIsBackfilling(true);
    try {
      const res = await api.post('/admin/backfill-section-batches');
      showToast(res.data.message || 'Batch backfill completed!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Batch sync failed', 'error');
    } finally {
      setIsBackfilling(false);
    }
  };

  const missingYearCount = sections.filter((s) => !s.year).length;
  const missingBatchCount = sections.filter((s) => !s.batch).length;

  // Delete confirmation state
  const [deletingSection, setDeletingSection] = useState<Section | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deletingSection) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/sections/${deletingSection._id}`);
      showToast(res.data?.message || 'Section deleted successfully', 'success');
      setDeletingSection(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete section', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Section>[] = [
    {
      header: 'Section Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 shadow-sm">
            {row.name}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-[11px] text-slate-500">Section ID: {row._id.slice(-6)}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Year Level',
      render: (row) => {
        const yr = row.year || Math.min(4, Math.max(1, Math.ceil((row.semester || 1) / 2)));
        return (
          <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
            <GraduationCap className="w-3 h-3 text-blue-600" />
            <span>Year {yr} ({yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : '4th'} Yr)</span>
          </span>
        );
      },
    },
    {
      header: 'Department / Course',
      render: (row) => {
        const d = row.department as Department;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-800 font-semibold">{d?.name || '—'} ({d?.code})</span>
            {d?.course && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {d.course.code || d.course.name}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Semester',
      accessor: (row) => `Semester ${row.semester}`,
      className: 'text-xs text-slate-600 font-medium tabular-nums',
    },
    {
      header: 'Batch Cohort',
      render: (row) => {
        const b = row.batch as Batch;
        return b?.name ? (
          <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700">
            <Calendar className="w-3 h-3 text-indigo-600" />
            <span>{b.name} Batch</span>
          </span>
        ) : (
          <span className="text-xs text-amber-600 italic font-medium">Unassigned</span>
        );
      },
    },
    {
      header: 'Academic Session',
      render: (row) => {
        const s = row.session as AcademicSession;
        return (
          <span className="text-xs text-slate-500">
            {s?.year || '—'} · {s?.semesterLabel}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Edit Section"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingSection(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Section"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Academic Sections</h2>
          <p className="text-xs text-slate-500">Configure class sections, year levels (1st - 4th), admission batches, and semester mappings</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Sections"
            exportUrl={`/admin/sections/export?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/sections/export-pdf?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
            }).toString()}`}
            pdfFilename="sections.pdf"
            importUrl="/admin/sections/import"
            onImportSuccess={fetchData}
            exportFilename="sections.csv"
          />

          <button
            onClick={handleBackfillYears}
            disabled={isBackfilling}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 transition-colors shadow-sm"
            title="Auto-assign year based on semester to any records missing it"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isBackfilling ? 'animate-spin' : ''}`} />
            <span>Sync Years</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Create Section</span>
          </button>
        </div>
      </div>

      {missingYearCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Data Notice:</strong> {missingYearCount} section(s) do not have a Year assigned yet.
            </span>
          </div>
          <button
            onClick={handleBackfillYears}
            className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold border border-amber-300 shadow-sm"
          >
            Auto-Fix Now
          </button>
        </div>
      )}

      {missingBatchCount > 0 && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Batch Notice:</strong> {missingBatchCount} section(s) need a Batch assigned.
            </span>
          </div>
          <button
            onClick={handleBackfillBatches}
            disabled={isBackfilling}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBackfilling ? 'animate-spin' : ''}`} />
            <span>Sync Batches</span>
          </button>
        </div>
      )}

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter by Course</span>
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
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter by Year</span>
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Years (1st - 4th)</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
            <option value="missing">Missing Year (needs update)</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Department</span>
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
        data={sections}
        isLoading={isLoading}
        searchPlaceholder="Search sections by name or department..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          ((row.department as Department)?.name?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSection ? 'Edit Academic Section' : 'Create Academic Section'}
        subtitle="Specify section name, year level (1st-4th), admission batch, and academic session"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Section Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CSE-4A"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>Course Program *</span>
              </label>
              <select
                value={modalCourse}
                onChange={(e) => {
                  const newCourseId = e.target.value;
                  setModalCourse(newCourseId);
                  const firstMatchingDept = departments.find(
                    (d) => (d.course?._id || d.course) === newCourseId
                  );
                  setDepartment(firstMatchingDept?._id || '');
                  const courseBatches = batches.filter((b) => (b.course?._id || b.course) === newCourseId);
                  setModalBatch(courseBatches[0]?._id || '');
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.code}) - {c.durationYears} Years
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Department *
              </label>
              <select
                value={department}
                disabled={!modalCourse}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{modalCourse ? 'Select Department' : 'Select Course First'}</option>
                {departments
                  .filter((d) => (d.course?._id || d.course) === modalCourse)
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Admission Batch Cohort *</span>
              </label>
              <select
                value={modalBatch}
                disabled={!modalCourse}
                onChange={(e) => setModalBatch(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{modalCourse ? 'Select Batch' : 'Select Course First'}</option>
                {batches
                  .filter((b) => (b.course?._id || b.course) === modalCourse)
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} Batch {b.isActive ? '(Active)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Year Level *
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value={1}>1st Year</option>
                <option value={2}>2nd Year</option>
                <option value={3}>3rd Year</option>
                <option value={4}>4th Year</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Semester *
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={semester}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setSemester(s);
                  if (!editingSection) {
                    setYear(Math.min(4, Math.max(1, Math.ceil(s / 2))));
                  }
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Academic Session *
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.year} - {s.semesterLabel} {s.isActive ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              <span>{editingSection ? 'Update Section' : 'Create Section'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingSection}
        onClose={() => !isDeleting && setDeletingSection(null)}
        title="Delete Section"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-semibold text-sm text-rose-900 mb-1">
                Are you sure you want to delete <span className="font-bold underline">{deletingSection?.name}</span>?
              </p>
              <p>
                This action cannot be undone. Sections with enrolled students, timetable slots, or recorded attendance history cannot be deleted until all references are removed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingSection(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={confirmDelete}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isDeleting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
