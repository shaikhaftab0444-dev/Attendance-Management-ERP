import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  School,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import { Batch, Course } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminBatches: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
  const [endYear, setEndYear] = useState<number>(new Date().getFullYear() + 4);
  const [name, setName] = useState('');
  const [isManualName, setIsManualName] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (courseFilter) params.course = courseFilter;
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';

      const [bRes, cRes] = await Promise.all([
        api.get('/admin/batches', { params }),
        api.get('/admin/courses'),
      ]);
      setBatches(bRes.data);
      setCourses(cRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching batches', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseFilter, statusFilter]);

  const handleCourseChange = (newCourseId: string) => {
    setSelectedCourseId(newCourseId);
    const crs = courses.find((c) => c._id === newCourseId);
    const duration = crs ? crs.durationYears : 4;
    const computedEnd = startYear + duration;
    setEndYear(computedEnd);
    if (!isManualName) {
      setName(`${startYear}-${computedEnd}`);
    }
  };

  const handleStartYearChange = (newStart: number) => {
    setStartYear(newStart);
    const crs = courses.find((c) => c._id === selectedCourseId);
    const duration = crs ? crs.durationYears : 4;
    const computedEnd = newStart + duration;
    setEndYear(computedEnd);
    if (!isManualName) {
      setName(`${newStart}-${computedEnd}`);
    }
  };

  const openCreateModal = () => {
    setEditingBatch(null);
    const firstCourse = courses[0]?._id || '';
    setSelectedCourseId(firstCourse);
    const currentYr = new Date().getFullYear();
    const crs = courses.find((c) => c._id === firstCourse);
    const duration = crs ? crs.durationYears : 4;
    const computedEnd = currentYr + duration;
    setStartYear(currentYr);
    setEndYear(computedEnd);
    setName(`${currentYr}-${computedEnd}`);
    setIsManualName(false);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (batch: Batch) => {
    setEditingBatch(batch);
    const cId = typeof batch.course === 'object' && batch.course ? batch.course._id : (batch.course as string);
    setSelectedCourseId(cId || (courses[0]?._id || ''));
    setStartYear(batch.startYear);
    setEndYear(batch.endYear);
    setName(batch.name);
    setIsManualName(true);
    setIsActive(batch.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !startYear || !endYear || !name) {
      showToast('Course, Start Year, End Year, and Batch Name are required.', 'warning');
      return;
    }

    if (endYear <= startYear) {
      showToast('End Year must be greater than Start Year.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBatch) {
        await api.patch(`/admin/batches/${editingBatch._id}`, {
          course: selectedCourseId,
          startYear: Number(startYear),
          endYear: Number(endYear),
          name: name.trim(),
          isActive,
        });
        showToast('Batch updated successfully', 'success');
      } else {
        await api.post('/admin/batches', {
          course: selectedCourseId,
          startYear: Number(startYear),
          endYear: Number(endYear),
          name: name.trim(),
          isActive,
        });
        showToast('Batch created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save batch', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingBatch) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/batches/${deletingBatch._id}`);
      showToast(res.data?.message || 'Batch deleted successfully', 'success');
      setDeletingBatch(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete batch', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Batch>[] = [
    {
      header: 'Batch Cohort',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center font-mono font-bold text-xs text-indigo-700">
            {row.name.substring(2, 4) || 'BT'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm font-mono">{row.name}</p>
            <p className="text-[11px] text-slate-500">
              {row.startYear} &rarr; {row.endYear} ({row.endYear - row.startYear} Years)
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Course Program',
      render: (row) => {
        const c = typeof row.course === 'object' && row.course ? row.course : null;
        if (!c) return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {c.code}
            </span>
            <span className="text-xs text-slate-600 font-medium">{c.name}</span>
          </div>
        );
      },
    },
    {
      header: 'Enrolled Students',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
          <Users className="w-3 h-3 text-slate-500" />
          <span>{row.studentCount || 0} Students</span>
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <StatusPill status={row.isActive ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Edit Batch"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingBatch(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Batch"
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
            <Calendar className="w-5 h-5 text-indigo-600" />
            <span>Academic Batches & Cohorts</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage admission-to-graduation student cohorts (e.g. 2024–2028), distinct from 1st–4th year levels
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Batches"
            exportUrl={`/admin/batches/export?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/batches/export-pdf?${new URLSearchParams({
              ...(courseFilter ? { course: courseFilter } : {}),
            }).toString()}`}
            importUrl="/admin/batches/import"
            onImportSuccess={fetchData}
            exportFilename="batches.csv"
            pdfFilename="academic_batches.pdf"
          />
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Create Batch</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-indigo-600" />
            <span>Filter by Course</span>
          </label>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
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
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter by Status</span>
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Batches</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={batches}
        isLoading={isLoading}
        searchPlaceholder="Search batch cohort name..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q.toLowerCase()) ||
          row.startYear.toString().includes(q) ||
          row.endYear.toString().includes(q)
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBatch ? 'Edit Batch Cohort' : 'Create New Batch'}
        subtitle={
          editingBatch
            ? `Editing parameters for ${editingBatch.name}`
            : 'Define a new admission cohort and duration for student grouping'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-indigo-600" />
              <span>Course Program *</span>
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">Select Course...</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code}) — {c.durationYears} Years
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Start Year (Admission) *
              </label>
              <input
                type="number"
                value={startYear}
                onChange={(e) => handleStartYearChange(Number(e.target.value))}
                min={2000}
                max={2099}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                End Year (Graduation) *
              </label>
              <input
                type="number"
                value={endYear}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setEndYear(val);
                  if (!isManualName) {
                    setName(`${startYear}-${val}`);
                  }
                }}
                min={2000}
                max={2099}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Batch Name / Label *
              </label>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Auto-computed from years</span>
              </span>
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsManualName(true);
              }}
              placeholder="e.g. 2024-2028"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="batch-active-toggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="batch-active-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Active Batch (Enrolls active students)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 text-white shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{editingBatch ? 'Save Changes' : 'Create Batch'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingBatch)}
        onClose={() => setDeletingBatch(null)}
        title="Confirm Batch Deletion"
        subtitle="Ensure no active student records are linked to this cohort"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to delete batch cohort <strong className="text-slate-900 font-mono">{deletingBatch?.name}</strong>?
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <strong>Note:</strong> Batches with enrolled students cannot be deleted to preserve academic history integrity.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeletingBatch(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            >
              {isDeleting ? 'Deleting...' : 'Delete Batch'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
