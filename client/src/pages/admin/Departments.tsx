import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Building2, AlertTriangle, School, Filter } from 'lucide-react';
import api from '../../lib/api';
import { Department, Course } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminDepartments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

  const fetchCourses = async () => {
    try {
      const res = await api.get('/admin/courses');
      setCourses(res.data);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (selectedCourseFilter) params.course = selectedCourseFilter;
      const res = await api.get('/admin/departments', { params });
      setDepartments(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error loading departments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [selectedCourseFilter]);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setCourseId(selectedCourseFilter || (courses.length > 0 ? courses[0]._id : ''));
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    const existingCourseId = typeof dept.course === 'object' && dept.course ? dept.course._id : dept.course || '';
    setCourseId(existingCourseId);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !courseId) {
      showToast('Name, Code, and Course are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingDept) {
        await api.patch(`/admin/departments/${editingDept._id}`, {
          name,
          code,
          course: courseId,
        });
        showToast('Department updated successfully', 'success');
      } else {
        await api.post('/admin/departments', {
          name,
          code,
          course: courseId,
        });
        showToast('Department created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save department', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDept) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/departments/${deletingDept._id}`);
      showToast(res.data?.message || 'Department deleted successfully', 'success');
      setDeletingDept(null);
      fetchDepartments();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete department', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const unassignedCourseCount = departments.filter((d) => !d.course).length;

  const columns: Column<Department>[] = [
    {
      header: 'Department',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 font-mono shadow-sm">
            {row.code}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500 font-mono">Code: {row.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Course Program',
      render: (row) => {
        const courseObj = typeof row.course === 'object' && row.course ? row.course : null;
        if (!courseObj) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3 h-3" />
              <span>Unassigned Course</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <School className="w-3 h-3 text-indigo-600" />
            <span>{courseObj.name} ({courseObj.code})</span>
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
            title="Edit Department"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingDept(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Department"
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
      {unassignedCourseCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-900">
              Migration Notice: {unassignedCourseCount} department(s) are missing an assigned Course program.
            </p>
            <p className="text-amber-700">
              Please click "Edit" on each unassigned department below and select a Course program to ensure proper HOD scoping and scheduling.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>Academic Departments</span>
          </h2>
          <p className="text-xs text-slate-500">Manage academic departments under course programs</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Course Filter */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-600">Course:</span>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="bg-transparent font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="">All Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <ImportExportBar
            entityName="Departments"
            exportUrl={`/admin/departments/export${selectedCourseFilter ? `?course=${selectedCourseFilter}` : ''}`}
            pdfExportUrl={`/admin/departments/export-pdf${selectedCourseFilter ? `?course=${selectedCourseFilter}` : ''}`}
            pdfFilename="departments.pdf"
            importUrl="/admin/departments/import"
            onImportSuccess={() => {
              fetchDepartments();
              fetchCourses();
            }}
            exportFilename="departments.csv"
          />

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={departments}
        isLoading={isLoading}
        searchPlaceholder="Search departments by name or code..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q) ||
          (row.course?.name && row.course.name.toLowerCase().includes(q))
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Edit Academic Department' : 'Create Academic Department'}
        subtitle="Specify department name, organizational code, and parent course program"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Course Program *
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Course Program...</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code}) — {c.durationYears} Years
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Department Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Science & Engineering"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Department Code (Unique per Course) *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CSE"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 uppercase font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Note: The same department code (e.g. CSE) can exist under multiple different course programs.
            </p>
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
              <span>{editingDept ? 'Update Department' : 'Create Department'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingDept}
        onClose={() => !isDeleting && setDeletingDept(null)}
        title="Delete Department"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-semibold text-sm text-rose-900 mb-1">
                Are you sure you want to delete <span className="font-bold underline">{deletingDept?.name}</span> ({deletingDept?.code})?
              </p>
              <p>
                This action cannot be undone. Departments with active sections, subjects, students, or faculty cannot be deleted until all dependent records are reassigned or removed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingDept(null)}
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
