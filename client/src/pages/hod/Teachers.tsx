import React, { useEffect, useState } from 'react';
import { Users, Mail, Phone, Building2 } from 'lucide-react';
import api from '../../lib/api';
import { User, TeacherSubjectAssignment, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodTeachers: React.FC = () => {
  const { user } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignment[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

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
            Instructors and faculty members teaching class sections in {formatYearLabel(user?.year)} across all departments
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
    </div>
  );
};
