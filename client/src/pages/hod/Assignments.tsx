import React, { useEffect, useState } from 'react';
import { Plus, BookOpen, User, Layers, Building2 } from 'lucide-react';
import api from '../../lib/api';
import { TeacherSubjectAssignment, User as UserType, Subject, Section, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodAssignments: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [teachers, setTeachers] = useState<UserType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [semFilter, setSemFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [teacher, setTeacher] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [session, setSession] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (semFilter !== 'all') params.semester = semFilter;

      const [asgnRes, tchRes, subRes, secRes, deptRes] = await Promise.all([
        api.get('/hod/teacher-subjects', { params }),
        api.get('/hod/teacher-directory'), // Cross-department faculty directory
        api.get('/hod/subjects', { params }),
        api.get('/hod/sections', { params: deptFilter !== 'all' ? { department: deptFilter } : {} }),
        api.get('/hod/departments'),
      ]);
      setAssignments(asgnRes.data);
      setTeachers(tchRes.data);
      setSubjects(subRes.data);
      setSections(secRes.data);
      setDepartments(deptRes.data);

      if (tchRes.data[0]) setTeacher(tchRes.data[0]._id);
      if (subRes.data[0]) setSubject(subRes.data[0]._id);
      if (secRes.data[0]) {
        setSection(secRes.data[0]._id);
        const sesId = secRes.data[0].session?._id || secRes.data[0].session;
        if (sesId) setSession(sesId);
      }
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching assignments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptFilter, semFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher || !subject || !section || !session) {
      showToast('Please select all required fields.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/hod/teacher-subjects', {
        teacher,
        subject,
        section,
        session,
      });
      showToast('Faculty subject allocation created successfully', 'success');
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to create assignment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<TeacherSubjectAssignment>[] = [
    {
      header: 'Assigned Teacher',
      render: (row) => {
        const homeDept = row.teacher?.department?.code || row.teacher?.department?.name;
        return (
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-purple-600" />
            <div>
              <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                {row.teacher?.name}
                {homeDept && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    {homeDept} Dept
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{row.teacher?.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Subject & Code',
      render: (row) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-600" />
          <div>
            <p className="font-semibold text-slate-900 text-sm">{row.subject?.name}</p>
            <p className="text-xs text-slate-500 font-mono">
              {row.subject?.code} · Sem {row.subject?.semester} · {row.subject?.credits} Credits
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Class Section & Department',
      render: (row) => {
        const dept = row.section?.department?.code || row.section?.department?.name;
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>{row.section?.name}</span>
            {dept && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] text-blue-700 font-mono font-bold">
                {dept}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Academic Session & Batch',
      render: (row) => {
        const batchName = row.section?.batch?.name || (typeof row.section?.batch === 'string' ? row.section.batch : '');
        return (
          <div className="flex flex-col gap-1">
            {batchName ? (
              <span className="inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 w-fit">
                {batchName} Batch
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 italic">No Batch</span>
            )}
            <span className="text-xs text-slate-500 font-medium">
              {row.session?.year} · {row.session?.semesterLabel}
            </span>
          </div>
        );
      },
    },
  ];

  const yearNum = user?.year || 1;
  const yearSemesters = [yearNum * 2 - 1, yearNum * 2];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{formatYearLabel(user?.year)} Faculty Subject Allocations</span>
          </h2>
          <p className="text-xs text-slate-500">
            Map campus instructors (including cross-department faculty) to {formatYearLabel(user?.year)} sections across all departments
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ImportExportBar
            entityName="Subject Allocations"
            exportUrl="/api/hod/teacher-subjects/export"
            exportFilename={`subject_allocations_year_${user?.year || 1}.csv`}
            pdfExportUrl="/api/hod/teacher-subjects/export-pdf"
            pdfFilename={`subject_allocations_year_${user?.year || 1}.pdf`}
            importUrl="/api/hod/teacher-subjects/import"
            onImportSuccess={fetchData}
            queryParams={{
              department: deptFilter !== 'all' ? deptFilter : undefined,
              semester: semFilter !== 'all' ? semFilter : undefined,
            }}
          />

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-purple-500/20 text-white w-fit"
          >
            <Plus className="w-4 h-4" />
            <span>New Subject Allocation</span>
          </button>
        </div>
      </div>

      {/* 2 Independent Filter Dropdowns: Department & Semester within locked Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Filter by Department</span>
          </label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
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
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Filter by Semester ({formatYearLabel(user?.year)})</span>
          </label>
          <select
            value={semFilter}
            onChange={(e) => setSemFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Year {yearNum} Semesters</option>
            {yearSemesters.map((sem) => (
              <option key={sem} value={sem.toString()}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={assignments}
        isLoading={isLoading}
        searchPlaceholder="Search allocations by teacher, subject, or section..."
        searchFilter={(row, q) =>
          (row.teacher?.name?.toLowerCase().includes(q) ?? false) ||
          (row.subject?.name?.toLowerCase().includes(q) ?? false) ||
          (row.section?.name?.toLowerCase().includes(q) ?? false) ||
          (row.section?.department?.code?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Course Subject to Faculty"
        subtitle={`Select from campus-wide faculty directory and allocate to ${formatYearLabel(user?.year)} section`}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Faculty Instructor (Cross-Department) *
            </label>
            <select
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              {teachers.map((t) => {
                const deptName = (t.department as any)?.code || (t.department as any)?.name || 'Campus';
                return (
                  <option key={t._id} value={t._id}>
                    {t.name} ({deptName} Dept) {t.employeeId ? `[${t.employeeId}]` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select Course Subject ({formatYearLabel(user?.year)}) *
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              {subjects.map((s) => {
                const deptCode = (s.department as any)?.code || (s.department as any)?.name || '';
                return (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.code} {deptCode ? `· ${deptCode}` : ''} · Sem {s.semester})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Target Class Section ({formatYearLabel(user?.year)}) *
            </label>
            <select
              value={section}
              onChange={(e) => {
                const secId = e.target.value;
                setSection(secId);
                const chosen = sections.find((s) => s._id === secId);
                const sesId = (chosen?.session as any)?._id || chosen?.session;
                if (sesId) setSession(sesId);
              }}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              {sections.map((sec) => {
                const dept = (sec.department as any)?.code || (sec.department as any)?.name || 'Dept';
                return (
                  <option key={sec._id} value={sec._id}>
                    {sec.name} ({dept} · Sem {sec.semester})
                  </option>
                );
              })}
            </select>
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
              <span>Save Allocation</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
