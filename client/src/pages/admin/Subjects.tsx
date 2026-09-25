import React, { useEffect, useState } from 'react';
import { Plus, BookOpen, Building2, Layers, GraduationCap, Edit2, Trash2, AlertTriangle, School, UserCheck, Archive, ArchiveRestore, Users } from 'lucide-react';
import api from '../../lib/api';
import { Subject, Department, Course, User, Batch } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [modalCourse, setModalCourse] = useState('');
  const [modalBatch, setModalBatch] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [credits, setCredits] = useState<number>(3);
  const [modalTeacher, setModalTeacher] = useState<string>('');
  const [showAllCourseFaculty, setShowAllCourseFaculty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Archive & Restore State
  const [archivingSubject, setArchivingSubject] = useState<Subject | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete confirmation state
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [deleteConflictMessage, setDeleteConflictMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Force Delete (Cascade) state
  const [forceDeletingSubject, setForceDeletingSubject] = useState<Subject | null>(null);
  const [forceDeleteConfirmCode, setForceDeleteConfirmCode] = useState('');
  const [isForceDeleting, setIsForceDeleting] = useState(false);

  const { showToast } = useToast();

  const formatYearLabel = (y?: number) => {
    if (!y) return '1st Year';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const fetchTeachersForCourse = async (
    courseId?: string,
    deptId?: string,
    yearVal?: number,
    showAll?: boolean
  ) => {
    try {
      const params: any = {};
      if (showAll) {
        if (courseId) {
          params.course = courseId;
          params.allCourse = true;
        } else {
          params.all = true;
        }
      } else {
        if (courseId) params.course = courseId;
        if (deptId) params.department = deptId;
        if (yearVal) params.year = yearVal;
      }
      const res = await api.get('/admin/teachers-for-course', { params });
      setTeachers(res.data);
      return res.data;
    } catch (err) {
      console.error('Error fetching teachers for course:', err);
      return [];
    }
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.isActive = statusFilter;
      } else {
        params.includeArchived = 'true';
      }
      if (courseFilter !== 'all') params.course = courseFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      if (batchFilter !== 'all') params.batch = batchFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (semesterFilter !== 'all') params.semester = semesterFilter;

      const [subRes, deptRes, crsRes, batchRes] = await Promise.all([
        api.get('/admin/subjects', { params }),
        api.get('/admin/departments'),
        api.get('/admin/courses'),
        api.get('/admin/batches'),
      ]);
      setSubjects(subRes.data);
      setDepartments(deptRes.data);
      setCourses(crsRes.data);
      setBatches(batchRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching curriculum subjects', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseFilter, yearFilter, batchFilter, departmentFilter, semesterFilter, statusFilter]);

  useEffect(() => {
    if (isModalOpen) {
      fetchTeachersForCourse(modalCourse, department, year, showAllCourseFaculty).then((newTeachers) => {
        if (modalTeacher && Array.isArray(newTeachers) && !newTeachers.some((t: any) => t._id === modalTeacher)) {
          setModalTeacher('');
        }
      });
    }
  }, [modalCourse, department, year, showAllCourseFaculty, isModalOpen]);

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setName('');
    setCode('');
    const firstCourse = courses[0]?._id || '';
    setModalCourse(firstCourse);
    setModalBatch('');
    const deptsForCourse = departments.filter((d) => (d.course?._id || d.course) === firstCourse);
    setDepartment(deptsForCourse[0]?._id || '');
    setYear(1);
    setSemester(1);
    setCredits(3);
    setModalTeacher('');
    setShowAllCourseFaculty(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setName(sub.name);
    setCode(sub.code);
    const deptDoc = (sub.department as any);
    const cId = deptDoc?.course?._id || deptDoc?.course || '';
    setModalCourse(cId);
    setModalBatch((sub as any).batch?._id || (sub as any).batch || '');
    setDepartment(deptDoc?._id || sub.department || '');
    setYear(sub.year || Math.min(4, Math.max(1, Math.ceil((sub.semester || 1) / 2))));
    setSemester(sub.semester || 1);
    setCredits(sub.credits || 3);
    const tId = sub.assignedTeacher?._id || sub.assignedTeacher || '';
    setModalTeacher(tId);
    setShowAllCourseFaculty(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !department || !semester || !year) {
      showToast('Please fill all mandatory fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (editingSubject) {
        res = await api.patch(`/admin/subjects/${editingSubject._id}`, {
          name,
          code,
          department,
          semester: Number(semester),
          year: Number(year),
          credits: Number(credits),
          teacher: modalTeacher || null,
          batch: modalBatch || null,
        });
      } else {
        res = await api.post('/admin/subjects', {
          name,
          code,
          department,
          semester: Number(semester),
          year: Number(year),
          credits: Number(credits),
          teacher: modalTeacher || null,
          batch: modalBatch || null,
        });
      }

      if (res.data?.assignedSectionsCount > 0 && res.data?.assignedTeacher?.name) {
        showToast(
          `Subject ${editingSubject ? 'updated' : 'created'} and ${res.data.assignedTeacher.name} assigned across ${res.data.assignedSectionsCount} matching section(s).`,
          'success'
        );
      } else {
        showToast(`Subject ${editingSubject ? 'updated' : 'created'} successfully.`, 'success');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save subject', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const semesterOptions = [1, 2, 3, 4, 5, 6, 7, 8];

  const confirmDelete = async () => {
    if (!deletingSubject) return;
    setIsDeleting(true);
    setDeleteConflictMessage(null);
    try {
      const res = await api.delete(`/admin/subjects/${deletingSubject._id}`);
      showToast(res.data?.message || 'Subject deleted successfully', 'success');
      setDeletingSubject(null);
      fetchData();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.customMessage || 'Failed to delete subject';
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
      const res = await api.patch(`/admin/subjects/${sub._id}/archive`);
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
      const res = await api.patch(`/admin/subjects/${sub._id}/restore`);
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
      const res = await api.delete(`/admin/subjects/${forceDeletingSubject._id}/force`);
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
      header: 'Subject Code',
      render: (row) => (
        <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
          {row.code}
        </span>
      ),
    },
    {
      header: 'Course Title',
      render: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="font-semibold text-slate-900 text-sm">{row.name}</span>
        </div>
      ),
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
      header: 'Academic Year',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
          <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
          <span>{formatYearLabel(row.year || Math.min(4, Math.max(1, Math.ceil((row.semester || 1) / 2))))}</span>
        </span>
      ),
    },
    {
      header: 'Batch Cohort',
      render: (row) => {
        const b = (row as any).batch;
        if (b && b.name) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-purple-700 font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200">
              <Users className="w-3 h-3 text-purple-600" />
              <span>{b.name}</span>
            </span>
          );
        }
        return <span className="text-xs text-slate-400 italic">All Cohorts</span>;
      },
    },
    {
      header: 'Semester',
      accessor: (row) => `Sem ${row.semester}`,
      className: 'text-xs text-slate-600 tabular-nums font-semibold',
    },
    {
      header: 'Academic Credits',
      render: (row) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 tabular-nums">
          {row.credits} Credits
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => {
        const isArchived = row.isActive === false;
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isArchived
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isArchived ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{isArchived ? 'Archived' : 'Active'}</span>
          </span>
        );
      },
    },
    {
      header: 'Assigned Faculty',
      render: (row) => {
        const teacher = row.assignedTeacher;
        if (teacher) {
          return (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{teacher.name}</span>
            </div>
          );
        }
        return <span className="text-xs text-slate-400 italic">Unassigned</span>;
      },
    },
    {
      header: 'Actions',
      render: (row) => {
        const isArchived = row.isActive === false;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleOpenEdit(row)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
              title="Edit Subject"
            >
              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Edit</span>
            </button>
            {isArchived ? (
              <button
                onClick={() => handleRestore(row)}
                disabled={isRestoring}
                className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
                title="Restore to Active"
              >
                <ArchiveRestore className="w-3.5 h-3.5 text-emerald-600" />
                <span>Restore</span>
              </button>
            ) : (
              <button
                onClick={() => setArchivingSubject(row)}
                className="p-1.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
                title="Archive Subject"
              >
                <Archive className="w-3.5 h-3.5 text-amber-600" />
                <span>Archive</span>
              </button>
            )}
            <button
              onClick={() => {
                setDeleteConflictMessage(null);
                setDeletingSubject(row);
              }}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
              title="Delete Subject"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Curriculum & Subjects</h2>
          <p className="text-xs text-slate-500">Course catalog, department affiliations, year mappings, batch cohorts, and academic credit values</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active / Archived Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'active'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'archived'
                  ? 'bg-white text-amber-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Archived</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
          </div>

          <ImportExportBar
            entityName="Subjects"
            exportUrl={`/admin/subjects/export?${new URLSearchParams({
              ...(statusFilter !== 'all' ? { isActive: statusFilter } : { includeArchived: 'true' }),
              ...(courseFilter !== 'all' ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
              ...(batchFilter !== 'all' ? { batch: batchFilter } : {}),
              ...(departmentFilter !== 'all' ? { department: departmentFilter } : {}),
              ...(semesterFilter !== 'all' ? { semester: semesterFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/subjects/export-pdf?${new URLSearchParams({
              ...(statusFilter !== 'all' ? { isActive: statusFilter } : { includeArchived: 'true' }),
              ...(courseFilter !== 'all' ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
              ...(batchFilter !== 'all' ? { batch: batchFilter } : {}),
              ...(departmentFilter !== 'all' ? { department: departmentFilter } : {}),
              ...(semesterFilter !== 'all' ? { semester: semesterFilter } : {}),
            }).toString()}`}
            pdfFilename="subjects.pdf"
            importUrl="/admin/subjects/import"
            onImportSuccess={fetchData}
            exportFilename="subjects.csv"
          />

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* 5 Filters: Course, Year, Batch, Department, Semester */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Course Filter */}
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
              if (newCourse !== 'all' && departmentFilter !== 'all') {
                const dept = departments.find((d) => d._id === departmentFilter);
                if (dept && (dept.course?._id || dept.course) !== newCourse) {
                  setDepartmentFilter('all');
                }
              }
              if (newCourse !== 'all' && batchFilter !== 'all') {
                const b = batches.find((b) => b._id === batchFilter);
                if (b && (b.course?._id || b.course) !== newCourse) {
                  setBatchFilter('all');
                }
              }
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
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
            <option value="all">All Academic Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">4th Year</option>
          </select>
        </div>

        {/* Batch Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-purple-600" />
            <span>Select Batch</span>
          </label>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Batches</option>
            {batches
              .filter((b) => courseFilter === 'all' || (b.course?._id || b.course) === courseFilter)
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} {b.startYear ? `(${b.startYear}-${b.endYear})` : ''}
                </option>
              ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Department</span>
          </label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Departments</option>
            {departments
              .filter((d) => courseFilter === 'all' || (d.course?._id || d.course) === courseFilter)
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code}) {d.course?.code ? `— ${d.course.code}` : ''}
                </option>
              ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Semester</span>
          </label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Semesters</option>
            {semesterOptions.map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        searchPlaceholder="Search subjects by title, code, or department..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.code.toLowerCase().includes(q) ||
          ((row.department as Department)?.name?.toLowerCase().includes(q) ?? false) ||
          ((row.department as Department)?.code?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Course Subject' : 'Create Course Subject'}
        subtitle="Specify subject details, credit allocation, department, batch cohort, and academic year"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Course Title *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Structures & Algorithms"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Subject Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CS401"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-600" />
                <span>Course *</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Academic Year *
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Batch Cohort
              </label>
              <select
                value={modalBatch}
                onChange={(e) => setModalBatch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">-- All Cohorts / General --</option>
                {batches
                  .filter((b) => !modalCourse || (b.course?._id || b.course) === modalCourse)
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.startYear}-{b.endYear})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Semester Level *
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={semester}
                onChange={(e) => {
                  const s = Number(e.target.value);
                  setSemester(s);
                  if (!editingSubject) {
                    setYear(Math.min(4, Math.max(1, Math.ceil(s / 2))));
                  }
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Credit Hours *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={credits}
                onChange={(e) => setCredits(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Assigned Faculty (Optional)</span>
            </label>
            <select
              value={modalTeacher}
              onChange={(e) => setModalTeacher(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="">-- No Faculty Assigned (Assign Later via Timetable) --</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.employeeId ? `${t.employeeId} · ` : ''}{t.department?.name || t.department?.code || 'Faculty'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Selecting a faculty member will automatically assign them to all matching sections in this department, year, and semester.
            </p>

            {/* Show All Course Faculty Checkbox */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllCourseFaculty}
                onChange={(e) => setShowAllCourseFaculty(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span className="text-xs text-slate-600 font-medium">
                Show all faculty in this course (any department/year)
              </span>
            </label>
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
              <span>{editingSubject ? 'Update Subject' : 'Save Subject'}</span>
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
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isArchiving}
              onClick={() => archivingSubject && handleArchive(archivingSubject)}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isArchiving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isArchiving ? 'Archiving...' : 'Confirm Archive'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingSubject}
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
                    Recommended: <strong>Archive</strong> this subject to retire it while preserving historical records. Alternatively, authorized administrators can perform a <strong>Force Delete</strong> to permanently wipe this subject and all associated data.
                  </p>
                </div>
              </div>
              <div className="pt-2 flex items-center justify-end gap-2 flex-wrap border-t border-amber-200/60">
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={() => deletingSubject && handleArchive(deletingSubject)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50"
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
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Force Delete</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 leading-relaxed">
                <p className="font-semibold text-sm text-rose-900 mb-1">
                  Are you sure you want to delete <span className="font-bold underline">{deletingSubject?.name}</span> ({deletingSubject?.code})?
                </p>
                <p>
                  This action cannot be undone. Subjects with active teacher allocations, timetable period slots, or recorded attendance history cannot be deleted until all references are removed.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting || isArchiving}
              onClick={() => {
                setDeletingSubject(null);
                setDeleteConflictMessage(null);
              }}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            {!deleteConflictMessage && (
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
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

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              To confirm permanent cascade deletion, please type the exact subject code <span className="font-mono font-bold text-red-600 select-all bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{forceDeletingSubject?.code}</span> below:
            </label>
            <input
              type="text"
              value={forceDeleteConfirmCode}
              onChange={(e) => setForceDeleteConfirmCode(e.target.value)}
              placeholder={`Type ${forceDeletingSubject?.code || ''} to confirm`}
              disabled={isForceDeleting}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 uppercase"
              autoFocus
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
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                isForceDeleting ||
                !forceDeletingSubject ||
                forceDeleteConfirmCode.trim().toUpperCase() !== forceDeletingSubject.code.trim().toUpperCase()
              }
              onClick={handleForceDelete}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isForceDeleting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>{isForceDeleting ? 'Permanently Deleting...' : 'Confirm Permanent Delete'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
