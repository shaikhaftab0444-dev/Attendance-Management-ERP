import React, { useEffect, useState } from 'react';
import { Plus, BookOpen, Building2, Layers, GraduationCap, Edit2, Trash2, AlertTriangle, School, UserCheck } from 'lucide-react';
import api from '../../lib/api';
import { Subject, Department, Course, User } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

export const AdminSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [modalCourse, setModalCourse] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState<number>(1);
  const [semester, setSemester] = useState<number>(1);
  const [credits, setCredits] = useState<number>(3);
  const [modalTeacher, setModalTeacher] = useState<string>('');
  const [showAllCourseFaculty, setShowAllCourseFaculty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      if (courseFilter !== 'all') params.course = courseFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      if (departmentFilter !== 'all') params.department = departmentFilter;
      if (semesterFilter !== 'all') params.semester = semesterFilter;

      const [subRes, deptRes, crsRes] = await Promise.all([
        api.get('/admin/subjects', { params }),
        api.get('/admin/departments'),
        api.get('/admin/courses'),
      ]);
      setSubjects(subRes.data);
      setDepartments(deptRes.data);
      setCourses(crsRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching curriculum subjects', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [courseFilter, yearFilter, departmentFilter, semesterFilter]);

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
    try {
      const res = await api.delete(`/admin/subjects/${deletingSubject._id}`);
      showToast(res.data?.message || 'Subject deleted successfully', 'success');
      setDeletingSubject(null);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete subject', 'error');
    } finally {
      setIsDeleting(false);
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
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Edit Subject"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingSubject(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Subject"
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Curriculum & Subjects</h2>
          <p className="text-xs text-slate-500">Course catalog, department affiliations, year mappings, and academic credit values</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Subjects"
            exportUrl={`/admin/subjects/export?${new URLSearchParams({
              ...(courseFilter !== 'all' ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
              ...(departmentFilter !== 'all' ? { department: departmentFilter } : {}),
              ...(semesterFilter !== 'all' ? { semester: semesterFilter } : {}),
            }).toString()}`}
            pdfExportUrl={`/admin/subjects/export-pdf?${new URLSearchParams({
              ...(courseFilter !== 'all' ? { course: courseFilter } : {}),
              ...(yearFilter !== 'all' ? { year: yearFilter } : {}),
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

      {/* 4 Filters: Course, Year, Department, Semester */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
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
        subtitle="Specify subject details, credit allocation, department, and academic year"
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingSubject}
        onClose={() => !isDeleting && setDeletingSubject(null)}
        title="Delete Subject"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingSubject(null)}
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
