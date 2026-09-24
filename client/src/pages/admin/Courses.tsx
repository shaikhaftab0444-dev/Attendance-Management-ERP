import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, School, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { Course } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [durationYears, setDurationYears] = useState<number>(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/courses');
      setCourses(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error loading courses', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const openCreateModal = () => {
    setEditingCourse(null);
    setName('');
    setCode('');
    setDurationYears(4);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Course) => {
    setEditingCourse(c);
    setName(c.name);
    setCode(c.code);
    setDurationYears(c.durationYears || 4);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !durationYears) {
      showToast('Name, Code, and Duration are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCourse) {
        await api.patch(`/admin/courses/${editingCourse._id}`, {
          name,
          code,
          durationYears: Number(durationYears),
        });
        showToast('Course updated successfully', 'success');
      } else {
        await api.post('/admin/courses', {
          name,
          code,
          durationYears: Number(durationYears),
        });
        showToast('Course created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchCourses();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save course', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingCourse) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/courses/${deletingCourse._id}`);
      showToast(res.data?.message || 'Course deleted successfully', 'success');
      setDeletingCourse(null);
      fetchCourses();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete course', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Course>[] = [
    {
      header: 'Course Program',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-xs text-indigo-700 font-mono shadow-sm">
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
      header: 'Duration',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
          {row.durationYears} {row.durationYears === 1 ? 'Year' : 'Years'} Program
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Edit Course"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingCourse(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Course"
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <School className="w-5 h-5 text-indigo-600" />
            <span>Academic Courses / Programs</span>
          </h2>
          <p className="text-xs text-slate-500">
            Define top-level degree programs (e.g. B.Tech, Diploma, MBA) governing departments and HOD scope
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Courses"
            exportUrl="/admin/courses/export"
            pdfExportUrl="/admin/courses/export-pdf"
            pdfFilename="courses.pdf"
            importUrl="/admin/courses/import"
            onImportSuccess={fetchCourses}
            exportFilename="courses.csv"
          />

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-indigo-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={courses}
        isLoading={isLoading}
        searchPlaceholder="Search courses by name or code..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q)
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCourse ? 'Edit Academic Course' : 'Create Academic Course'}
        subtitle="Specify course program name, code, and duration in years"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Course Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bachelor of Technology"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Course Code (Unique) *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BTECH"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Duration (Years) *
            </label>
            <input
              type="number"
              min={1}
              max={6}
              value={durationYears}
              onChange={(e) => setDurationYears(parseInt(e.target.value) || 1)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              e.g. 4 for 4-year undergraduate degree, 3 for 3-year diploma, 2 for master's degree.
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
              <span>{editingCourse ? 'Update Course' : 'Create Course'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingCourse}
        onClose={() => !isDeleting && setDeletingCourse(null)}
        title="Delete Academic Course"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-semibold text-sm text-rose-900 mb-1">
                Are you sure you want to delete <span className="font-bold underline">{deletingCourse?.name}</span> ({deletingCourse?.code})?
              </p>
              <p>
                This action cannot be undone. Courses with assigned academic departments cannot be deleted until those departments are reassigned or deleted.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingCourse(null)}
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
