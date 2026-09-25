import React, { useEffect, useState } from 'react';
import { BookOpen, Building2, Layers, Plus, Edit2, Trash2, AlertTriangle, GraduationCap, Archive, ArchiveRestore } from 'lucide-react';
import api from '../../lib/api';
import { Subject, Department, Batch, User } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodSubjects: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [semFilter, setSemFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState<number>(1);
  const [credits, setCredits] = useState<number>(3);
  const [modalBatch, setModalBatch] = useState<string>('');
  const [modalTeacher, setModalTeacher] = useState<string>('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete / Archive / Restore / Force Delete state
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deleteConflictMessage, setDeleteConflictMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archivingSubject, setArchivingSubject] = useState<Subject | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [forceDeletingSubject, setForceDeletingSubject] = useState<Subject | null>(null);
  const [forceDeleteConfirmCode, setForceDeleteConfirmCode] = useState('');
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const { showToast } = useToast();

  const hodYear = user?.year || 1;
  const availableSemesters = [hodYear * 2 - 1, hodYear * 2];

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
      if (semFilter !== 'all') params.semester = semFilter;
      if (batchFilter !== 'all') params.batch = batchFilter;
      if (statusFilter !== 'all') {
        params.isActive = statusFilter;
      } else {
        params.includeArchived = 'true';
      }

      const [subRes, deptRes, batchRes, tchRes] = await Promise.all([
        api.get('/hod/subjects', { params }),
        api.get('/hod/departments'),
        api.get('/hod/batches'),
        api.get('/hod/teacher-directory'),
      ]);
      setSubjects(subRes.data);
      setDepartments(deptRes.data);
      setBatches(batchRes.data);
      setTeachers(tchRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching subjects', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptFilter, semFilter, batchFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingSubject(null);
    setName('');
    setCode('');
    setDepartment(departments[0]?._id || '');
    setSemester(availableSemesters[0]);
    setCredits(3);
    setModalBatch('');
    setModalTeacher('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (sub: Subject) => {
    setEditingSubject(sub);
    setName(sub.name);
    setCode(sub.code);
    setDepartment((sub.department as Department)?._id || (sub.department as string) || '');
    setSemester(sub.semester || availableSemesters[0]);
    setCredits(sub.credits || 3);
    setModalBatch((sub.batch as Batch)?._id || (sub.batch as string) || '');
    setModalTeacher((sub.assignedTeacher as User)?._id || (sub.assignedTeacher as string) || '');
    setIsActive(sub.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast('Subject Name and Code are required.', 'warning');
      return;
    }
    if (!department) {
      showToast('Please select a Department.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        department,
        semester: Number(semester),
        credits: Number(credits),
        batch: modalBatch || null,
        teacher: modalTeacher || null,
      };

      if (editingSubject) {
        payload.isActive = isActive;
        await api.patch(`/hod/subjects/${editingSubject._id}`, payload);
        showToast('Subject updated successfully', 'success');
      } else {
        await api.post('/hod/subjects', payload);
        showToast('Subject created successfully', 'success');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || err.message || 'Failed to save subject', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;
    try {
      setIsDeleting(true);
      setDeleteConflictMessage(null);
      const res = await api.delete(`/hod/subjects/${deletingSubject._id}`);
      showToast(res.data?.message || 'Subject deleted successfully', 'success');
      setDeletingSubject(null);
      fetchData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.customMessage || 'Error removing subject';
      if (
        err.response?.status === 409 ||
        errorMsg.includes('associated with it') ||
        errorMsg.includes('allocation') ||
        errorMsg.includes('timetable slot') ||
        errorMsg.includes('attendance')
      ) {
        setDeleteConflictMessage(errorMsg);
      } else {
        showToast(errorMsg, 'error');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleArchive = async (sub: Subject) => {
    setIsArchiving(true);
    try {
      const res = await api.patch(`/hod/subjects/${sub._id}/archive`);
      showToast(res.data?.message || `Subject '${sub.name}' archived successfully`, 'success');
      setArchivingSubject(null);
      setDeletingSubject(null);
      setDeleteConflictMessage(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to archive subject', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestore = async (sub: Subject) => {
    setIsRestoring(true);
    try {
      const res = await api.patch(`/hod/subjects/${sub._id}/restore`);
      showToast(res.data?.message || `Subject '${sub.name}' restored successfully`, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to restore subject', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleForceDelete = async () => {
    if (!forceDeletingSubject) return;
    if (forceDeleteConfirmCode.trim().toUpperCase() !== forceDeletingSubject.code.trim().toUpperCase()) {
      showToast(`Subject code does not match '${forceDeletingSubject.code}'.`, 'warning');
      return;
    }

    setIsForceDeleting(true);
    try {
      const res = await api.delete(`/hod/subjects/${forceDeletingSubject._id}/force`);
      showToast(res.data?.message || `Subject '${forceDeletingSubject.name}' and all associated records permanently destroyed.`, 'success');
      setForceDeletingSubject(null);
      setForceDeleteConfirmCode('');
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || err.response?.data?.message || 'Failed to force delete subject', 'error');
    } finally {
      setIsForceDeleting(false);
    }
  };

  const columns: Column<Subject>[] = [
    {
      header: 'Subject & Code',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center font-bold text-sm text-purple-700 shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-xs font-mono font-medium text-purple-700">{row.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      render: (row) => {
        const d = row.department as Department;
        return d ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-purple-600" />
            <span>{d.name} ({d.code})</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">—</span>
        );
      },
    },
    {
      header: 'Semester & Credits',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <span className="font-semibold text-slate-800">Semester {row.semester}</span>
          <p className="text-slate-500">{row.credits} Credits</p>
        </div>
      ),
    },
    {
      header: 'Batch Cohort',
      render: (row) => {
        const b = row.batch as Batch;
        return b ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-semibold shadow-sm">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>{b.name}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">All Cohorts</span>
        );
      },
    },
    {
      header: 'Status',
      render: (row) => <StatusPill status={row.isActive !== false ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
            title="Edit Subject"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {row.isActive !== false ? (
            <button
              onClick={() => setArchivingSubject(row)}
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              title="Archive Subject"
            >
              <Archive className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => handleRestore(row)}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
              title="Restore Subject"
            >
              <ArchiveRestore className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setDeletingSubject(row);
              setDeleteConflictMessage(null);
            }}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Delete Subject"
          >
            <Trash2 className="w-4 h-4" />
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
            <BookOpen className="w-5 h-5 text-purple-600" />
            <span>{formatYearLabel(user?.year)} Curriculum Subjects</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage course subjects and syllabi for {formatYearLabel(user?.year)} (Semesters {availableSemesters.join(' & ')})
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

          {/* Semester Filter */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <GraduationCap className="w-4 h-4 text-purple-600" />
            <select
              value={semFilter}
              onChange={(e) => setSemFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Semesters</option>
              {availableSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          {batches.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <Layers className="w-4 h-4 text-indigo-600" />
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Cohorts</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-purple-500"
            >
              <option value="active">Active Subjects</option>
              <option value="archived">Archived Subjects</option>
              <option value="all">All Statuses</option>
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        searchPlaceholder="Search subjects by name or code..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q) ||
          ((row.department as Department)?.name?.toLowerCase().includes(q) ?? false) ||
          ((row.batch as Batch)?.name?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Add / Edit Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Curriculum Subject' : 'Add New Subject'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Subject Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Data Structures & Algorithms"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Subject Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CS201"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono uppercase focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Department *
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              >
                <option value="">Select Department...</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Semester Level *
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              >
                {availableSemesters.map((s) => (
                  <option key={s} value={s}>
                    Semester {s} ({formatYearLabel(hodYear)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Academic Credits
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Target Batch Cohort
              </label>
              <select
                value={modalBatch}
                onChange={(e) => setModalBatch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              >
                <option value="">All Cohorts (Universal)</option>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.startYear}-{b.endYear})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!editingSubject && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Assign Primary Teacher (Optional)
              </label>
              <select
                value={modalTeacher}
                onChange={(e) => setModalTeacher(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              >
                <option value="">No Initial Teacher Assignment</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {editingSubject && (
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="subject-active-checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="subject-active-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Subject is Active
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : editingSubject ? 'Save Changes' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={!!archivingSubject}
        onClose={() => !isArchiving && setArchivingSubject(null)}
        title="Archive Subject"
        subtitle="Retire subject from active course catalogue"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed space-y-1.5">
              <p className="font-semibold text-sm text-amber-950">
                Archive <span className="underline font-bold">{archivingSubject?.name}</span> ({archivingSubject?.code})?
              </p>
              <p>
                Archiving will retire this subject from active course selection, timetable schedulers, and new faculty assignments.
              </p>
              <p className="text-amber-800 font-medium">
                ✓ All existing attendance sessions, past teacher allocations, and historical student records remain completely intact and reportable.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isArchiving}
              onClick={() => setArchivingSubject(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isArchiving}
              onClick={() => archivingSubject && handleArchive(archivingSubject)}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isArchiving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isArchiving ? 'Archiving...' : 'Confirm Archive'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete / Archive Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingSubject)}
        onClose={() => {
          if (!isDeleting) {
            setDeletingSubject(null);
            setDeleteConflictMessage(null);
          }
        }}
        title="Delete Subject"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          {deleteConflictMessage ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold text-sm text-amber-950 mb-1">Cannot Safe-Delete Subject</p>
                  <p className="mb-2">{deleteConflictMessage}</p>
                  <p className="font-medium text-amber-800">
                    Recommended: <strong>Archive</strong> this subject to retire it while preserving historical records. Alternatively, perform a <strong>Force Delete</strong> to permanently wipe this subject and all associated data.
                  </p>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 flex-wrap border-t border-amber-200/60">
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={() => deletingSubject && handleArchive(deletingSubject)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isArchiving ? 'Archiving...' : 'Archive Instead'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = deletingSubject;
                    setDeletingSubject(null);
                    setDeleteConflictMessage(null);
                    setForceDeletingSubject(target);
                    setForceDeleteConfirmCode('');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Force Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs">
                <p className="font-semibold text-rose-900 mb-1">
                  Are you sure you want to delete <span className="font-bold underline">{deletingSubject?.name}</span> ({deletingSubject?.code})?
                </p>
                <p className="text-rose-700">
                  This action cannot be undone. Subjects with active teacher allocations, timetable slots, or recorded attendance history cannot be deleted directly without force delete or archiving.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting || isArchiving}
              onClick={() => {
                setDeletingSubject(null);
                setDeleteConflictMessage(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            {!deleteConflictMessage && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer flex items-center gap-2"
              >
                {isDeleting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* Strict Safeguard Force Delete Modal */}
      <Modal
        isOpen={!!forceDeletingSubject}
        onClose={() => {
          if (!isForceDeleting) {
            setForceDeletingSubject(null);
            setForceDeleteConfirmCode('');
          }
        }}
        title="Permanent Cascade Delete"
        subtitle="Critical Destruction Safeguard"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 leading-relaxed space-y-2">
              <p className="font-bold text-sm text-red-950">
                CRITICAL: This will permanently destroy this subject along with ALL associated attendance history, timetable slots, and faculty allocations. This action CANNOT be undone.
              </p>
              <p className="text-red-800">
                Target Subject: <span className="font-bold underline text-red-950">{forceDeletingSubject?.name}</span> (Code: <span className="font-mono font-bold text-red-950">{forceDeletingSubject?.code}</span>)
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type the exact subject code <span className="font-mono font-bold text-red-600">{forceDeletingSubject?.code}</span> to confirm:
            </label>
            <input
              type="text"
              value={forceDeleteConfirmCode}
              onChange={(e) => setForceDeleteConfirmCode(e.target.value)}
              placeholder={forceDeletingSubject?.code}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 uppercase focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isForceDeleting}
              onClick={() => {
                setForceDeletingSubject(null);
                setForceDeleteConfirmCode('');
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isForceDeleting || forceDeleteConfirmCode.trim().toUpperCase() !== forceDeletingSubject?.code.trim().toUpperCase()}
              onClick={handleForceDelete}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isForceDeleting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isForceDeleting ? 'Force Deleting...' : 'I understand, permanently delete'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
