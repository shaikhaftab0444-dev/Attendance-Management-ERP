import React, { useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  GraduationCap,
  Mail,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  AlertTriangle,
  School,
  PhoneCall,
  Calendar,
  Copy,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import api from '../../lib/api';
import { Student, Department, Section, Course, Batch } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { PhoneInput, extractPhoneDigits, isPhoneValid } from '../../components/ui/PhoneInput';
import { useToast } from '../../context/ToastContext';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [courseFilter, setCourseFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [secFilter, setSecFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('');
  const [showOnlyInvalidPhones, setShowOnlyInvalidPhones] = useState(false);

  // Delete confirmation state
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Student Form
  const [modalCourse, setModalCourse] = useState('');
  const [batch, setBatch] = useState('');
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [section, setSection] = useState('');
  const [semester, setSemester] = useState(1);
  const [year, setYear] = useState<number>(1);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Bulk Import Form
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  // Duplicate Detection & Resolution
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [isDetectingDuplicates, setIsDetectingDuplicates] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [selectedResolutions, setSelectedResolutions] = useState<{ [groupKey: string]: string }>({});
  const [isResolvingDuplicates, setIsResolvingDuplicates] = useState(false);

  const { showToast } = useToast();

  const handleDetectDuplicates = async () => {
    setIsDetectingDuplicates(true);
    try {
      const res = await api.get('/admin/students/duplicates');
      if (res.data.totalGroups === 0) {
        showToast('No duplicate student records detected! Database is clean.', 'success');
      } else {
        setDuplicateGroups(res.data.groups);
        const initialResolutions: { [key: string]: string } = {};
        res.data.groups.forEach((g: any) => {
          initialResolutions[g.key] = g.recommendedKeepId;
        });
        setSelectedResolutions(initialResolutions);
        setIsDuplicateModalOpen(true);
        showToast(`Found ${res.data.totalGroups} duplicate student group(s).`, 'warning');
      }
    } catch (err: any) {
      showToast(err.customMessage || 'Error checking for duplicate students', 'error');
    } finally {
      setIsDetectingDuplicates(false);
    }
  };

  const handleResolveDuplicates = async () => {
    setIsResolvingDuplicates(true);
    try {
      const resolutionsPayload = duplicateGroups.map((g) => {
        const keepId = selectedResolutions[g.key] || g.recommendedKeepId;
        const removeIds = g.students.filter((s: any) => s._id !== keepId).map((s: any) => s._id);
        return {
          keepId,
          removeIds,
          mergeAttendance: true,
        };
      });

      const res = await api.post('/admin/students/resolve-duplicates', {
        resolutions: resolutionsPayload,
      });

      showToast(res.data.message || 'Duplicates resolved successfully!', 'success');
      setIsDuplicateModalOpen(false);
      fetchStudents();
      fetchDependencies();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to resolve duplicate students', 'error');
    } finally {
      setIsResolvingDuplicates(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [deptRes, secRes, crsRes, batchRes] = await Promise.all([
        api.get('/admin/departments'),
        api.get('/admin/sections'),
        api.get('/admin/courses'),
        api.get('/admin/batches'),
      ]);
      setDepartments(deptRes.data);
      setSections(secRes.data);
      setCourses(crsRes.data);
      setBatches(batchRes.data);
    } catch (err: any) {
      console.error('Error loading deps:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (courseFilter) params.course = courseFilter;
      if (deptFilter) params.department = deptFilter;
      if (secFilter) params.section = secFilter;
      if (yearFilter !== 'all') params.year = yearFilter;
      if (batchFilter) params.batch = batchFilter;

      const res = await api.get('/admin/students', { params });
      setStudents(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching student roster', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [courseFilter, deptFilter, secFilter, yearFilter, batchFilter]);

  const openCreateModal = () => {
    setEditingStudent(null);
    setName('');
    setRollNumber('');
    const firstCourse = courses[0]?._id || '';
    setModalCourse(firstCourse);
    const batchesForCourse = batches.filter(
      (b) => (b.course?._id || b.course) === firstCourse && b.isActive
    );
    setBatch(batchesForCourse[0]?._id || '');
    const deptsForCourse = departments.filter(
      (d) => (d.course?._id || d.course) === firstCourse
    );
    const firstDept = deptsForCourse[0]?._id || '';
    setDepartment(firstDept);
    const matchingSec = sections.find((s) => (s.department as any)?._id === firstDept || s.department === firstDept);
    const chosenSec = matchingSec?._id || '';
    setSection(chosenSec);
    const secDoc = sections.find((s) => s._id === chosenSec);
    setYear(secDoc?.year || 1);
    setSemester(secDoc?.semester || 1);
    setEmail('');
    setPhone('');
    setIsActive(true);
    setIsStudentModalOpen(true);
  };

  const openEditModal = (st: Student) => {
    setEditingStudent(st);
    setName(st.name);
    setRollNumber(st.rollNumber);
    const cId = st.department?.course?._id || st.department?.course || '';
    setModalCourse(cId);
    setBatch(st.batch?._id || st.batch || '');
    setDepartment(st.department?._id || st.department || '');
    setSection(st.section?._id || st.section || '');
    setSemester(st.semester || 1);
    setYear(st.year || st.section?.year || 1);
    setEmail(st.email || '');
    setPhone(extractPhoneDigits(st.phone));
    setIsActive(st.isActive);
    setIsStudentModalOpen(true);
  };

  const handleSubmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rollNumber || !department || !section || !semester || !year) {
      showToast('Please fill all mandatory fields.', 'warning');
      return;
    }

    if (phone && !isPhoneValid(phone)) {
      showToast('Phone number must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.', 'warning');
      return;
    }

    const formattedPhone = phone && phone.trim().length > 0 ? `+91${phone.trim().replace(/\D/g, '')}` : '';

    setIsSubmitting(true);
    try {
      if (editingStudent) {
        await api.patch(`/admin/students/${editingStudent._id}`, {
          name,
          rollNumber,
          department,
          section,
          batch: batch || null,
          semester: Number(semester),
          year: Number(year),
          email,
          phone: formattedPhone,
          isActive,
        });
        showToast('Student updated successfully', 'success');
      } else {
        await api.post('/admin/students', {
          name,
          rollNumber,
          department,
          section,
          batch: batch || null,
          semester: Number(semester),
          year: Number(year),
          email,
          phone: formattedPhone,
        });
        showToast('Student enrolled successfully', 'success');
      }
      setIsStudentModalOpen(false);
      fetchStudents();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to save student record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      showToast('Please select a CSV file to upload.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await api.post('/admin/students/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      showToast(res.data.message || 'Import processed', 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err.customMessage || 'Bulk import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBackfillYears = async () => {
    setIsBackfilling(true);
    try {
      const res = await api.post('/admin/backfill-years');
      showToast(res.data.message || 'Years synchronized successfully!', 'success');
      fetchStudents();
    } catch (err: any) {
      showToast(err.customMessage || 'Backfill failed', 'error');
    } finally {
      setIsBackfilling(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent =
      'name,rollNumber,courseCode,departmentCode,sectionName,year,semester,batchName,email,phone\n' +
      'Aarav Sharma,23CSE050,BTECH,CSE,CSE-4A,2,4,2023-2027,aarav.sharma@attendedge.edu,+919876543210\n' +
      'Ananya Reddy,23CSE051,BTECH,CSE,CSE-4A,2,4,2023-2027,ananya.reddy@attendedge.edu,+919876543211\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'attendedge_students_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSectionsForDept = sections.filter(
    (s) => !department || (s.department as any)?._id === department || s.department === department
  );

  const confirmDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/admin/students/${deletingStudent._id}`);
      showToast(res.data?.message || 'Student deleted successfully', 'success');
      setDeletingStudent(null);
      fetchStudents();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete student', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const invalidPhoneStudents = students.filter((s) => s.phone && !/^\+91[6-9]\d{9}$/.test(s.phone));

  const columns: Column<Student>[] = [
    {
      header: 'Roll Number',
      render: (row) => (
        <span className="font-mono font-bold text-slate-800 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
          {row.rollNumber}
        </span>
      ),
    },
    {
      header: 'Student Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Mail className="w-3 h-3 text-slate-400" />
            {row.email || 'No email registered'}
          </p>
        </div>
      ),
    },
    {
      header: 'Year',
      render: (row) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {row.year ? `${row.year} Year` : 'Missing Year'}
        </span>
      ),
    },
    {
      header: 'Batch',
      render: (row) => (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {row.batch?.name || '—'}
        </span>
      ),
    },
    {
      header: 'Department / Course',
      render: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-800">
            {row.department?.code || row.department?.name || '—'}
          </span>
          {row.department?.course && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {row.department.course.code || row.department.course.name}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Section / Sem',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs text-slate-700 font-medium">
            {row.section?.name || '—'} (Sem {row.semester})
          </span>
        </div>
      ),
    },
    {
      header: 'Phone',
      render: (row) => {
        const isPhoneInvalidRecord = row.phone && !/^\+91[6-9]\d{9}$/.test(row.phone);
        return (
          <span
            className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              isPhoneInvalidRecord
                ? 'text-rose-700 bg-rose-50 border border-rose-200 font-semibold inline-flex items-center gap-1'
                : 'text-slate-600'
            }`}
          >
            {isPhoneInvalidRecord && <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />}
            <span>{row.phone || '—'}</span>
            {isPhoneInvalidRecord && <span className="text-[10px] uppercase font-bold text-rose-600">(Invalid)</span>}
          </span>
        );
      },
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
            title="Edit Student"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setDeletingStudent(row)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 text-xs font-semibold shadow-sm"
            title="Delete Student"
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
      {invalidPhoneStudents.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950">
                Data Quality Warning: {invalidPhoneStudents.length} student(s) have invalid phone numbers
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
            <span>{showOnlyInvalidPhones ? 'Show All Students' : `Review ${invalidPhoneStudents.length} Invalid Phone(s)`}</span>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Student Records & Roster</h2>
          <p className="text-xs text-slate-500">Manage enrolled students, academic year levels, cohorts, and CSV/PDF reports</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDetectDuplicates}
            disabled={isDetectingDuplicates}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 transition-colors shadow-sm"
            title="Scan database for duplicate student records (by Roll Number or Email)"
          >
            <Copy className={`w-3.5 h-3.5 text-indigo-600 ${isDetectingDuplicates ? 'animate-spin' : ''}`} />
            <span>Detect Duplicates</span>
          </button>
          <button
            onClick={handleBackfillYears}
            disabled={isBackfilling}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 flex items-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isBackfilling ? 'animate-spin' : ''}`} />
            <span>Sync Years</span>
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Student</span>
          </button>
        </div>
      </div>

      {/* Import / Export Utility Bar */}
      <ImportExportBar
        entityName="Students"
        exportUrl="/api/admin/students/export"
        exportFilename="students.csv"
        pdfExportUrl="/api/admin/students/export-pdf"
        pdfFilename="students.pdf"
        importUrl="/api/admin/students/bulk-import"
        onImportSuccess={fetchStudents}
      />

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
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
              if (newCourse && batchFilter) {
                const b = batches.find((item) => item._id === batchFilter);
                if (b && (b.course?._id || b.course) !== newCourse) {
                  setBatchFilter('');
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
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter by Batch</span>
          </label>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Batches</option>
            {batches
              .filter((b) => !courseFilter || (b.course?._id || b.course) === courseFilter)
              .map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.course?.code || ''})
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
            <option value="missing">Missing Year</option>
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

        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Filter by Section</span>
          </label>
          <select
            value={secFilter}
            onChange={(e) => setSecFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            <option value="">All Sections</option>
            {sections.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} (Year {s.year || 1})
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={showOnlyInvalidPhones ? invalidPhoneStudents : students}
        isLoading={isLoading}
        searchPlaceholder="Search by student name or roll number..."
        searchFilter={(row, q) =>
          row.name.toLowerCase().includes(q) ||
          row.rollNumber.toLowerCase().includes(q) ||
          (row.batch?.name?.toLowerCase().includes(q) ?? false) ||
          (row.email?.toLowerCase().includes(q) ?? false) ||
          (row.phone?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Enroll / Edit Student Modal */}
      <Modal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title={editingStudent ? 'Edit Student Details' : 'Enroll New Student'}
        subtitle="Specify student information, batch cohort, and section allocation"
      >
        <form onSubmit={handleSubmitStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Kumar"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Roll Number *
              </label>
              <input
                type="text"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="23CSE001"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 uppercase font-mono"
              />
            </div>
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
                  const batchesForCourse = batches.filter(
                    (b) => (b.course?._id || b.course) === newCourseId && b.isActive
                  );
                  setBatch(batchesForCourse[0]?._id || '');
                  const firstMatchingDept = departments.find(
                    (d) => (d.course?._id || d.course) === newCourseId
                  );
                  const nextDeptId = firstMatchingDept?._id || '';
                  setDepartment(nextDeptId);
                  const matchingSec = sections.find(
                    (s) => (s.department as any)?._id === nextDeptId || s.department === nextDeptId
                  );
                  setSection(matchingSec?._id || '');
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
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Batch (Cohort)</span>
              </label>
              <select
                value={batch}
                disabled={!modalCourse}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{modalCourse ? 'Select Batch (Optional)' : 'Select Course First'}</option>
                {batches
                  .filter((b) => (b.course?._id || b.course) === modalCourse)
                  .map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name} ({b.startYear} - {b.endYear})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Department *
              </label>
              <select
                value={department}
                disabled={!modalCourse}
                onChange={(e) => {
                  const deptId = e.target.value;
                  setDepartment(deptId);
                  const matchingSec = sections.find(
                    (s) => (s.department as any)?._id === deptId || s.department === deptId
                  );
                  setSection(matchingSec?._id || '');
                }}
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Class Section *
              </label>
              <select
                value={section}
                disabled={!department}
                onChange={(e) => {
                  const secId = e.target.value;
                  setSection(secId);
                  const chosen = sections.find((s) => s._id === secId);
                  if (chosen) {
                    if (chosen.year) setYear(chosen.year);
                    if (chosen.semester) setSemester(chosen.semester);
                  }
                }}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{department ? 'Select Section' : 'Select Dept First'}</option>
                {filteredSectionsForDept.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} (Year {s.year || 1})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                onChange={(e) => setSemester(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@attendedge.edu"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
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

          {editingStudent && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="stActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-0"
              />
              <label htmlFor="stActive" className="text-xs font-medium text-slate-700">
                Active Student Enrollment
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsStudentModalOpen(false)}
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
              <span>{editingStudent ? 'Update Student' : 'Enroll Student'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Bulk Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Bulk Import Student Roster"
        subtitle="Upload a .csv file containing student enrollment records (including Year)"
        maxWidth="xl"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2.5 text-xs text-blue-800 font-medium">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>Standard CSV Format with Year</span>
            </div>
            <button
              type="button"
              onClick={downloadSampleCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
          </div>

          <form onSubmit={handleBulkImport} className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 rounded-2xl p-6 text-center transition-all">
              <input
                type="file"
                id="csvInput"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="csvInput" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-blue-600 shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {csvFile ? csvFile.name : 'Click to select or drag CSV file'}
                </p>
                <p className="text-xs text-slate-500">
                  {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Maximum file size: 5MB'}
                </p>
              </label>
            </div>

            {importResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-800 font-semibold">{importResult.message}</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{importResult.importedCount} Imported</span>
                </div>
                {importResult.errorsCount > 0 && (
                  <div className="text-xs text-rose-600 pt-2 border-t border-slate-200 space-y-1 max-h-32 overflow-y-auto">
                    <p className="font-bold">{importResult.errorsCount} row errors encountered:</p>
                    {importResult.errors.map((err: any, i: number) => (
                      <div key={i} className="text-[11px] text-rose-700">
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!csvFile || isImporting}
                className="px-5 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 text-white shadow-sm"
              >
                {isImporting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                <span>Upload & Process CSV</span>
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingStudent}
        onClose={() => !isDeleting && setDeletingStudent(null)}
        title="Delete Student Record"
        subtitle="Confirmation required"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 leading-relaxed">
              <p className="font-semibold text-sm text-rose-900 mb-1">
                Are you sure you want to delete <span className="font-bold underline">{deletingStudent?.name}</span> ({deletingStudent?.rollNumber})?
              </p>
              <p>
                If this student has recorded attendance history, they will be safely <strong>deactivated</strong> (soft-deleted) to preserve historical accuracy on past reports, removing them from active rosters. If they have zero attendance history, their record will be deleted permanently.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setDeletingStudent(null)}
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

      {/* Duplicate Detection & Resolution Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={() => !isResolvingDuplicates && setIsDuplicateModalOpen(false)}
        title="Duplicate Student Records Detected"
        subtitle="Review and select which student record to keep as canonical"
        maxWidth="2xl"
      >
        <div className="space-y-5">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold text-amber-950 mb-0.5">
                Safe Merge & Deduplication
              </p>
              <p>
                Select the primary student profile to keep for each duplicate group. Unselected duplicate student records will be removed, and all existing <strong>attendance session records</strong> will automatically be remapped to your chosen student profile so no attendance history is lost.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {duplicateGroups.map((group, gIdx) => (
              <div key={group.key || gIdx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    {group.title}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {group.students.length} Records Found
                  </span>
                </div>

                <div className="space-y-2">
                  {group.students.map((st: any) => {
                    const isSelected = selectedResolutions[group.key] === st._id;
                    const isRecommended = group.recommendedKeepId === st._id;

                    return (
                      <label
                        key={st._id}
                        onClick={() => setSelectedResolutions((prev) => ({ ...prev, [group.key]: st._id }))}
                        className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name={`duplicate-group-${group.key}`}
                            checked={isSelected}
                            onChange={() => setSelectedResolutions((prev) => ({ ...prev, [group.key]: st._id }))}
                            className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-slate-300"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900">{st.name}</span>
                              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {st.rollNumber}
                              </span>
                              {isRecommended && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Recommended
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                              <span>Dept: {st.department?.code || '—'}</span>
                              <span>•</span>
                              <span>Sec: {st.section?.name || '—'}</span>
                              <span>•</span>
                              <span>Batch: {st.batch?.name || '—'}</span>
                              {st.email && (
                                <>
                                  <span>•</span>
                                  <span>{st.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            st.attendanceCount > 0
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {st.attendanceCount} Session(s)
                          </span>
                          <StatusPill status={st.isActive ? 'active' : 'inactive'} />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isResolvingDuplicates}
              onClick={() => setIsDuplicateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isResolvingDuplicates}
              onClick={handleResolveDuplicates}
              className="px-5 py-2 rounded-xl text-xs font-semibold gradient-btn text-white shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isResolvingDuplicates && (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              <span>{isResolvingDuplicates ? 'Resolving Duplicates...' : `Resolve & Clean Up (${duplicateGroups.length} Group${duplicateGroups.length > 1 ? 's' : ''})`}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
