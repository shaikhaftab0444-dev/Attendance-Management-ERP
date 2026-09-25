import React, { useEffect, useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CalendarRange,
  Zap,
} from 'lucide-react';
import api from '../../lib/api';
import { AcademicSession } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { useToast } from '../../context/ToastContext';

const SEMESTER_PRESETS = [
  'Odd Semester',
  'Even Semester',
  'Odd',
  'Even',
  'Sem 1',
  'Sem 2',
  'Sem 3',
  'Sem 4',
  'Sem 5',
  'Sem 6',
  'Sem 7',
  'Sem 8',
  'Fall Semester',
  'Spring Semester',
  'Summer Term',
];

export const AdminSessions: React.FC = () => {
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [year, setYear] = useState('');
  const [semesterLabel, setSemesterLabel] = useState('Odd Semester');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal State
  const [deletingSession, setDeletingSession] = useState<AcademicSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/sessions');
      setSessions(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || err.customMessage || 'Error fetching academic sessions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openCreateModal = () => {
    setEditingSession(null);
    const currentYear = new Date().getFullYear();
    setYear(`${currentYear}-${currentYear + 1}`);
    setSemesterLabel('Odd Semester');
    const today = new Date().toISOString().split('T')[0];
    const sixMonthsLater = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(sixMonthsLater);
    setIsActive(sessions.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (session: AcademicSession) => {
    setEditingSession(session);
    setYear(session.year);
    setSemesterLabel(session.semesterLabel);
    setStartDate(session.startDate ? new Date(session.startDate).toISOString().split('T')[0] : '');
    setEndDate(session.endDate ? new Date(session.endDate).toISOString().split('T')[0] : '');
    setIsActive(!!session.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!year.trim()) {
      showToast('Please enter an academic year (e.g. 2026-2027)', 'warning');
      return;
    }
    if (!semesterLabel.trim()) {
      showToast('Please specify a semester label (e.g. Odd Semester)', 'warning');
      return;
    }
    if (!startDate || !endDate) {
      showToast('Please provide both start and end dates', 'warning');
      return;
    }
    if (new Date(startDate) >= new Date(endDate)) {
      showToast('End date must be after start date', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        year: year.trim(),
        semesterLabel: semesterLabel.trim(),
        startDate,
        endDate,
        isActive,
      };

      if (editingSession) {
        await api.patch(`/admin/sessions/${editingSession._id}`, payload);
        showToast('Academic session updated successfully', 'success');
      } else {
        await api.post('/admin/sessions', payload);
        showToast('Academic session created successfully', 'success');
      }

      setIsModalOpen(false);
      fetchSessions();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.customMessage || 'Failed to save academic session', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSetActive = async (session: AcademicSession) => {
    if (session.isActive) return;
    try {
      await api.patch(`/admin/sessions/${session._id}`, { isActive: true });
      showToast(`Session "${session.year} - ${session.semesterLabel}" is now active`, 'success');
      fetchSessions();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.customMessage || 'Failed to activate session', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingSession) return;
    try {
      setIsDeleting(true);
      await api.delete(`/admin/sessions/${deletingSession._id}`);
      showToast('Academic session deleted successfully', 'success');
      setDeletingSession(null);
      fetchSessions();
    } catch (err: any) {
      showToast(err.response?.data?.message || err.customMessage || 'Failed to delete academic session', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeSession = sessions.find((s) => s.isActive);

  const columns: Column<AcademicSession>[] = [
    {
      header: 'Academic Year',
      accessor: 'year',
      render: (session) => (
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${session.isActive ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-500'}`}>
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{session.year}</div>
            <div className="text-xs text-slate-400">ID: {session._id.slice(-6)}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Semester Term / Label',
      accessor: 'semesterLabel',
      render: (session) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100/80">
            {session.semesterLabel}
          </span>
          {session.isActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
              <Zap className="w-2.5 h-2.5 fill-current" />
              CURRENT
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Session Duration',
      accessor: 'startDate',
      render: (session) => {
        const start = session.startDate ? new Date(session.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
        const end = session.endDate ? new Date(session.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
        return (
          <div className="text-xs text-slate-600">
            <div className="font-medium text-slate-800 flex items-center gap-1.5">
              <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
              {start} &rarr; {end}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'isActive',
      render: (session) => (
        <StatusPill
          status={session.isActive ? 'active' : 'inactive'}
          label={session.isActive ? 'Active Session' : 'Inactive'}
        />
      ),
    },
    {
      header: 'Actions',
      accessor: '_id',
      render: (session) => (
        <div className="flex items-center gap-1.5 justify-end">
          {!session.isActive && (
            <button
              onClick={() => handleQuickSetActive(session)}
              title="Set as Active Academic Session"
              className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Activate
            </button>
          )}
          <button
            onClick={() => openEditModal(session)}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Session"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingSession(session)}
            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Session"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100/80">
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Academic Sessions</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage global academic years, semester terms (Odd/Even/Semesters), and term date boundaries
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Session
        </button>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Configured</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{sessions.length}</div>
            <div className="text-xs text-slate-500 mt-0.5">Historical & active semesters</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Academic Session</div>
            <div className="text-base font-bold text-slate-900 mt-0.5 truncate">
              {activeSession ? `${activeSession.year} (${activeSession.semesterLabel})` : 'None Active'}
            </div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">
              {activeSession ? 'Applied to Sections & PDF Reports' : 'Please activate one'}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Term Span</div>
            <div className="text-xs font-semibold text-slate-800 mt-1">
              {activeSession && activeSession.startDate && activeSession.endDate
                ? `${new Date(activeSession.startDate).toLocaleDateString()} - ${new Date(activeSession.endDate).toLocaleDateString()}`
                : 'Not Set'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Term calendar window</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={sessions}
          isLoading={isLoading}
          searchPlaceholder="Search academic year or semester term..."
          emptyTitle="No academic sessions configured yet"
          emptyDescription="Create an academic session to begin configuring terms and schedules."
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSession ? 'Edit Academic Session' : 'Create New Academic Session'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2026-2027 or 2025-2026"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">Standard format: YYYY-YYYY (e.g. 2025-2026)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Semester Term / Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={semesterLabel}
              onChange={(e) => setSemesterLabel(e.target.value)}
              placeholder="e.g. Odd Semester, Even Semester, Sem 1, Sem 2"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900"
            />
            
            {/* Presets Quick Picker */}
            <div className="mt-2">
              <span className="text-[11px] font-medium text-slate-500 block mb-1.5">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {SEMESTER_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSemesterLabel(preset)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      semesterLabel === preset
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <div>
                <span className="text-sm font-semibold text-slate-800">Set as Active Session</span>
                <p className="text-xs text-slate-500">
                  Activating this session will automatically mark all other academic sessions as inactive.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-all"
            >
              {isSubmitting ? 'Saving...' : editingSession ? 'Update Session' : 'Create Session'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingSession}
        onClose={() => setDeletingSession(null)}
        title="Delete Academic Session"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-red-50 text-red-700 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold">Are you sure you want to delete this session?</p>
              <p className="mt-1 text-red-600">
                Session: <span className="font-bold">{deletingSession?.year} - {deletingSession?.semesterLabel}</span>.
                Sessions linked to sections or subject allocations cannot be deleted.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDeletingSession(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition-all"
            >
              {isDeleting ? 'Deleting...' : 'Delete Session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
