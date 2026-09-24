import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Users as UsersIcon, Mail, AlertTriangle, School, Filter, Eye, EyeOff, PhoneCall } from 'lucide-react';
import api from '../../lib/api';
import { User, Department, Course, UserRole } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { PhoneInput, extractPhoneDigits, isPhoneValid } from '../../components/ui/PhoneInput';
import { RoleScopeFields } from '../../components/staff/RoleScopeFields';
import { useToast } from '../../context/ToastContext';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showOnlyInvalidPhones, setShowOnlyInvalidPhones] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('teacher');
  const [department, setDepartment] = useState('');
  const [courseId, setCourseId] = useState('');
  const [year, setYear] = useState<number>(1);
  const [teachingYears, setTeachingYears] = useState<number[]>([1]);
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { showToast } = useToast();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (roleFilter) params.role = roleFilter;
      if (deptFilter) params.department = deptFilter;
      if (courseFilter) params.course = courseFilter;
      if (yearFilter) params.year = yearFilter;

      const [uRes, dRes, cRes] = await Promise.all([
        api.get('/admin/users', { params }),
        api.get('/admin/departments'),
        api.get('/admin/courses'),
      ]);
      setUsers(uRes.data);
      setDepartments(dRes.data);
      setCourses(cRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching staff members', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [roleFilter, deptFilter, courseFilter, yearFilter]);

  const openCreateModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('teacher');
    const firstCourse = courses[0]?._id || '';
    setCourseId(firstCourse);
    const deptsForCourse = departments.filter((d) => (d.course?._id || d.course) === firstCourse);
    setDepartment(deptsForCourse[0]?._id || '');
    setYear(1);
    setTeachingYears([1]);
    setEmployeeId('');
    setPhone('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword('');
    setShowPassword(false);
    setRole(user.role);
    const deptDoc = user.department as Department;
    const userCourseId = typeof user.course === 'object' && user.course
      ? user.course._id
      : (user.course as string) || (deptDoc?.course?._id || (deptDoc?.course as string) || (courses[0]?._id || ''));
    setCourseId(userCourseId);
    setDepartment((user.department as Department)?._id || (user.department as string) || '');
    setYear(user.year || 1);
    setTeachingYears(user.teachingYears && user.teachingYears.length > 0 ? user.teachingYears : [1]);
    setEmployeeId(user.employeeId || '');
    setPhone(extractPhoneDigits(user.phone));
    setIsActive(user.isActive);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || (!editingUser && !password)) {
      showToast('Name, Email, and Password are required.', 'warning');
      return;
    }

    if (role === 'teacher') {
      if (!department) {
        showToast('Please select a home department for the teacher.', 'warning');
        return;
      }
      if (!teachingYears || teachingYears.length === 0) {
        showToast('Please select at least one Teaching Year for the teacher.', 'warning');
        return;
      }
    }

    if (role === 'hod') {
      if (!courseId) {
        showToast('Please select an assigned Course Program for the HOD.', 'warning');
        return;
      }
      if (!year) {
        showToast('Please select an assigned Academic Year for the HOD.', 'warning');
        return;
      }
    }

    if (phone && !isPhoneValid(phone)) {
      showToast('Phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.', 'warning');
      return;
    }

    const formattedPhone = phone && phone.trim().length > 0 ? `+91${phone.trim().replace(/\D/g, '')}` : undefined;

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await api.patch(`/admin/users/${editingUser._id}`, {
          name,
          email,
          password: password || undefined,
          role,
          department: role === 'teacher' ? department : null,
          course: role === 'hod' ? courseId : null,
          year: role === 'hod' ? Number(year) : null,
          teachingYears: role === 'teacher' ? teachingYears : undefined,
          employeeId,
          phone: formattedPhone,
          isActive,
        });
        showToast('User account updated successfully', 'success');
      } else {
        await api.post('/admin/users', {
          name,
          email,
          password,
          role,
          department: role === 'teacher' ? department : null,
          course: role === 'hod' ? courseId : null,
          year: role === 'hod' ? Number(year) : null,
          teachingYears: role === 'teacher' ? teachingYears : undefined,
          employeeId,
          phone: formattedPhone,
        });
        showToast('User account created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save user account', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatYearLabel = (y?: number) => {
    if (!y) return '—';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/users/${deletingUser._id}`);
      showToast(res.data?.message || 'User deleted successfully', 'success');
      setDeletingUser(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete user', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCourseObj = courses.find((c) => c._id === courseId);
  const maxYearsForCourse = selectedCourseObj ? selectedCourseObj.durationYears : 4;
  const courseYearsArray = Array.from({ length: maxYearsForCourse }, (_, i) => i + 1);

  // Helper map to find which (courseId, year) combination has an active HOD
  const hodCourseYearMap = new Map<string, User>();
  users.forEach((u) => {
    if (u.role === 'hod' && u.isActive && u.year) {
      const cId = typeof u.course === 'object' && u.course ? u.course._id : (u.course as string);
      if (cId) {
        hodCourseYearMap.set(`${cId}_${u.year}`, u);
      }
    }
  });

  const unassignedHodsCount = users.filter((u) => u.role === 'hod' && (!u.course || !u.year)).length;

  const invalidPhoneUsers = users.filter((u) => u.phone && !/^\+91[6-9]\d{9}$/.test(u.phone));

  const columns: Column<User>[] = [
    {
      header: 'Staff Member',
      render: (row) => {
        const isPhoneInvalidRecord = row.phone && !/^\+91[6-9]\d{9}$/.test(row.phone);
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-sm text-blue-700 shadow-sm">
              {row.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{row.name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {row.email}
                </p>
                {row.phone && (
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                      isPhoneInvalidRecord
                        ? 'text-rose-700 bg-rose-50 border border-rose-200 font-semibold flex items-center gap-1'
                        : 'text-slate-500'
                    }`}
                  >
                    {isPhoneInvalidRecord && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
                    <span>{row.phone}</span>
                    {isPhoneInvalidRecord && <span className="text-[10px] uppercase font-bold text-rose-600">(Invalid)</span>}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Role',
      render: (row) => <StatusPill status={row.role} />,
    },
    {
      header: 'Scope / Department / Course & Year',
      render: (row) => {
        if (row.role === 'admin') {
          return <span className="text-xs text-slate-500 italic">Institution Wide</span>;
        }
        if (row.role === 'hod') {
          const c = typeof row.course === 'object' && row.course ? row.course : null;
          if (!c) {
            return (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                <AlertTriangle className="w-3 h-3" />
                <span>Unassigned Course · {formatYearLabel(row.year)} HOD</span>
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
              <School className="w-3 h-3 text-purple-600" />
              <span>{c.code} · {formatYearLabel(row.year)} HOD</span>
            </span>
          );
        }
        const d = row.department as Department;
        const dCourse = typeof d?.course === 'object' && d?.course ? d.course : null;
        return (
          <span className="text-xs text-slate-700 font-medium">
            {d?.name || '—'} {d?.code ? `(${d.code})` : ''} {dCourse ? `· ${dCourse.code}` : ''}
          </span>
        );
      },
    },
    {
      header: 'Teaching Years',
      render: (row) => {
        if (row.role === 'admin') {
          return <span className="text-xs text-slate-400 italic">Institution Wide</span>;
        }
        if (row.role === 'hod') {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
              {formatYearLabel(row.year)} HOD
            </span>
          );
        }

        const eligibleYears = row.teachingYears || [];
        const liveYears = row.currentlyTeachingYears || [];

        return (
          <div className="space-y-1.5 py-0.5 min-w-[170px]">
            {/* Eligible Years */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Eligible:</span>
              {eligibleYears.length === 0 ? (
                <span className="text-xs text-slate-400 italic">None</span>
              ) : (
                eligibleYears.map((yr) => (
                  <span
                    key={yr}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium"
                  >
                    {formatYearLabel(yr)}
                  </span>
                ))
              )}
            </div>

            {/* Currently Teaching */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-blue-500 tracking-wider">Teaching:</span>
              {liveYears.length === 0 ? (
                <span className="text-xs text-slate-400 italic">None</span>
              ) : (
                liveYears.map((yr) => (
                  <span
                    key={yr}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold shadow-xs"
                  >
                    {formatYearLabel(yr)}
                  </span>
                ))
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Employee ID',
      accessor: (row) => row.employeeId || '—',
      className: 'text-xs text-slate-500 font-mono',
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
            title="Edit User"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingUser(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete User"
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
      {/* Data Quality Notice Banner */}
      {invalidPhoneUsers.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950">
                Data Quality Warning: {invalidPhoneUsers.length} staff member(s) have invalid phone numbers
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Legacy sample records have non-Indian mobile formats (e.g. +1 555...). Click below to review and correct these records.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowOnlyInvalidPhones(!showOnlyInvalidPhones)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto shrink-0"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{showOnlyInvalidPhones ? 'Show All Staff' : `Review ${invalidPhoneUsers.length} Invalid Phone(s)`}</span>
          </button>
        </div>
      )}

      {unassignedHodsCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-900">
              Migration Notice: {unassignedHodsCount} HOD account(s) are missing an assigned Course program or Year.
            </p>
            <p className="text-amber-700">
              Please click "Edit" on each unassigned HOD below and select a Course program and Year to restore proper scoped governance.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-blue-600" />
            <span>Staff & Faculty Directory</span>
          </h2>
          <p className="text-xs text-slate-500">Manage institution administrators, Course+Year HODs, and instructors</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Staff Directory"
            exportUrl={`/admin/users/export?${new URLSearchParams({
              ...(roleFilter ? { role: roleFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(yearFilter ? { year: yearFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/users/export-pdf?${new URLSearchParams({
              ...(roleFilter ? { role: roleFilter } : {}),
              ...(deptFilter ? { department: deptFilter } : {}),
              ...(courseFilter ? { course: courseFilter } : {}),
              ...(yearFilter ? { year: yearFilter } : {}),
            }).toString()}`}
            pdfFilename="staff_directory.pdf"
            importUrl="/admin/users/import"
            onImportSuccess={fetchData}
            exportFilename="staff_directory.csv"
          />

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm max-w-4xl">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Filter by Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Roles</option>
            <option value="admin">Administrator</option>
            <option value="hod">Course+Year HOD</option>
            <option value="teacher">Subject Teacher</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Filter by Course
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
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Filter by Department
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

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Filter by Year
          </label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={showOnlyInvalidPhones ? invalidPhoneUsers : users}
        isLoading={isLoading}
        searchPlaceholder="Search staff by name, email, or employee ID..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q.toLowerCase()) ||
          row.email.toLowerCase().includes(q.toLowerCase()) ||
          (row.employeeId && row.employeeId.toLowerCase().includes(q.toLowerCase()))
        }
      />

      {/* User Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit Staff Account' : 'Create Staff Account'}
        subtitle={
          editingUser
            ? `Editing credentials and assignments for ${editingUser.name}`
            : 'Add a new administrator, Course+Year HOD, or instructor'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Jane Doe"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@attendedge.edu"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                {editingUser ? 'New Password (Optional)' : 'Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? 'Leave blank to keep unchanged' : '••••••••'}
                  required={!editingUser}
                  className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Assigned Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="teacher">Subject Teacher</option>
              <option value="hod">HOD (Course & Year Head of Department)</option>
              <option value="admin">System Administrator</option>
            </select>
          </div>

          {/* Shared Role Scope Fields */}
          <RoleScopeFields
            role={role}
            courses={courses}
            departments={departments}
            users={users}
            courseId={courseId}
            setCourseId={setCourseId}
            departmentId={department}
            setDepartmentId={setDepartment}
            year={year}
            setYear={setYear}
            teachingYears={teachingYears}
            setTeachingYears={setTeachingYears}
            editingUserId={editingUser?._id}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="EMP-101"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono"
              />
            </div>

            <div>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                label="Phone Number"
                placeholder="9876543210"
              />
            </div>
          </div>

          {editingUser && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="userActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-0"
              />
              <label htmlFor="userActive" className="text-xs font-medium text-slate-700">
                Active Account Status
              </label>
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
              <span>{editingUser ? 'Update User' : 'Create User'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => !isDeleting && setDeletingUser(null)}
        title="Delete Staff Account"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-semibold text-sm text-rose-900 mb-1">
                Are you sure you want to delete <span className="font-bold underline">{deletingUser?.name}</span> ({deletingUser?.email})?
              </p>
              {deletingUser?.role === 'hod' && deletingUser?.year && (
                <p className="font-bold text-rose-900 bg-rose-100/80 p-2 rounded-lg my-1 border border-rose-300/80">
                  ⚠️ Warning: This user is currently the active HOD for {deletingUser.course?.name || deletingUser.course?.code || 'Course'} · {deletingUser.year}{deletingUser.year === 1 ? 'st' : deletingUser.year === 2 ? 'nd' : deletingUser.year === 3 ? 'rd' : 'th'} Year. Deleting them will leave this Course+Year pair without an assigned HOD.
                </p>
              )}
              <p>
                If this user has teaching history, timetable period slots, or administrative assignments, they will be safely <strong>deactivated</strong> (soft-deleted) to protect historical records. If they have zero history, their account will be permanently deleted.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingUser(null)}
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
              <span>{isDeleting ? 'Processing...' : 'Confirm Delete'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
