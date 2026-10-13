import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, Building2, Plus, Edit2, Trash2, Eye, EyeOff, AlertTriangle, Layers } from 'lucide-react';
import api from '../../lib/api';
import { User, TeacherSubjectAssignment, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { PhoneInput, extractPhoneDigits, isPhoneValid } from '../../components/ui/PhoneInput';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodTeachers: React.FC = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deletingTeacher, setDeletingTeacher] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

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

      const [tchRes, asgnRes, deptRes] = await Promise.all([
        api.get('/hod/teachers', { params }),
        api.get('/hod/teacher-subjects', { params }),
        api.get('/hod/departments'),
      ]);
      setTeachers(tchRes.data);
      setAssignments(asgnRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching year faculty', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptFilter]);

  const openCreateModal = () => {
    setEditingTeacher(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setDepartment(departments[0]?._id || '');
    setEmployeeId('');
    setPhone('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (t: User) => {
    setEditingTeacher(t);
    setName(t.name);
    setEmail(t.email);
    setPassword('');
    setShowPassword(false);
    setDepartment((t.department as Department)?._id || (t.department as string) || '');
    setEmployeeId(t.employeeId || '');
    setPhone(extractPhoneDigits(t.phone));
    setIsActive(t.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Name and Email are required.', 'warning');
      return;
    }
    if (!editingTeacher && !password.trim()) {
      showToast('Password is required for new teacher accounts.', 'warning');
      return;
    }
    if (!department) {
      showToast('Please select a department.', 'warning');
      return;
    }
    if (phone && !isPhoneValid(phone)) {
      showToast('Please enter a valid 10-digit Indian mobile number.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department,
        employeeId: employeeId.trim(),
        phone: phone ? `+91${phone.trim()}` : '',
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      if (editingTeacher) {
        payload.isActive = isActive;
        await api.patch(`/hod/teachers/${editingTeacher._id}`, payload);
        showToast('Teacher updated successfully', 'success');
      } else {
        await api.post('/hod/teachers', payload);
        showToast('Teacher created successfully', 'success');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || err.message || 'Failed to save teacher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTeacher) return;
    try {
      setIsDeleting(true);
      const res = await api.delete(`/hod/teachers/${deletingTeacher._id}`);
      showToast(res.data?.message || 'Teacher removed successfully', 'success');
      setDeletingTeacher(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Error removing teacher', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<User>[] = [
    {
      header: 'Faculty Member',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center font-bold text-sm text-purple-700 shadow-sm">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              {row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Home Department',
      render: (row) => {
        const d = row.department as Department;
        return d ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-semibold shadow-sm">
            <Building2 className="w-3.5 h-3.5 text-purple-600" />
            <span>{d.name} ({d.code})</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400 italic">Campus Faculty</span>
        );
      },
    },
    {
      header: 'Employee ID',
      accessor: (row) => row.employeeId || '—',
      className: 'text-xs text-slate-500 font-mono font-medium',
    },
    {
      header: `Assigned Subjects (${formatYearLabel(user?.year)})`,
      render: (row) => {
        const myAssignments = assignments.filter(
          (a) => (a.teacher?._id || a.teacher) === row._id
        );
        return (
          <div className="flex flex-wrap gap-1.5">
            {myAssignments.length > 0 ? (
              myAssignments.map((a) => (
                <span
                  key={a._id}
                  className="px-2.5 py-0.5 rounded-lg bg-purple-50 border border-purple-200 text-[11px] text-purple-800 font-semibold shadow-sm"
                >
                  {a.subject?.name} ({a.section?.name || 'Sec'} · {a.section?.department?.code || ''})
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">No assigned subjects</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Contact',
      render: (row) => (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" />
          {row.phone || '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <StatusPill status={row.isActive ? 'active' : 'inactive'} />,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
            title="Edit Teacher"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeletingTeacher(row)}
            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            title="Delete / Deactivate Teacher"
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
            <Users className="w-5 h-5 text-purple-600" />
            <span>{formatYearLabel(user?.year)} Faculty Members</span>
          </h2>
          <p className="text-xs text-slate-500">
            Manage instructors and faculty members teaching class sections in {formatYearLabel(user?.year)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center gap-2 p-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <Building2 className="w-4 h-4 text-purple-600" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Teacher</span>
          </button>

          <ImportExportBar
            entityName="Faculty Members"
            pdfExportUrl="/hod/teachers/export-pdf"
            pdfFilename={`Year_${user?.year || 1}_Faculty_Members.pdf`}
            queryParams={deptFilter !== 'all' ? { department: deptFilter } : {}}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        isLoading={isLoading}
        searchPlaceholder="Search faculty by name, email, or employee ID..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          (row.employeeId?.toLowerCase().includes(q) ?? false) ||
          ((row.department as Department)?.name?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Add / Edit Teacher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Teacher Details' : 'Add New Teacher'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Doe"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@college.edu"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                {editingTeacher ? 'New Password (Leave blank to keep current)' : 'Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required={!editingTeacher}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Home Department *
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-1024"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10"
              />
            </div>

            <PhoneInput
              value={phone}
              onChange={setPhone}
              label="Contact Phone"
              placeholder="9876543210"
            />
          </div>

          {editingTeacher && (
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="teacher-active-checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="teacher-active-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Teacher Account is Active
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
              {isSubmitting ? 'Saving...' : editingTeacher ? 'Save Changes' : 'Create Teacher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingTeacher)}
        onClose={() => setDeletingTeacher(null)}
        title="Remove Teacher"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs">
              <p className="font-semibold">Are you sure you want to remove this faculty member?</p>
              <p className="mt-1 text-rose-700">
                Teacher <strong>{deletingTeacher?.name}</strong> ({deletingTeacher?.email}) will be removed. If this teacher has active subject allocations or timetable slots, their account will be deactivated to protect historical attendance data.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeletingTeacher(null)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-sm cursor-pointer"
            >
              {isDeleting ? 'Removing...' : 'Confirm Remove'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
