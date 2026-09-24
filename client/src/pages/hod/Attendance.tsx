import React, { useEffect, useState } from 'react';
import { Calendar, Eye, Building2 } from 'lucide-react';
import api from '../../lib/api';
import { Attendance, Department } from '../../types';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { StatusPill } from '../../components/ui/StatusPill';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { formatDateTime, formatDate } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HodAttendance: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      const [attRes, deptRes] = await Promise.all([
        api.get('/hod/attendance', { params }),
        api.get('/hod/departments'),
      ]);
      setLogs(attRes.data);
      setDepartments(deptRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching attendance logs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [deptFilter]);

  const columns: Column<Attendance>[] = [
    {
      header: 'Lecture Date',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-600" />
          <span className="font-semibold text-slate-900">{formatDate(row.date)}</span>
        </div>
      ),
    },
    {
      header: 'Course Subject',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 text-sm">{(row.subject as any)?.name}</p>
          <p className="text-xs text-slate-500 font-mono">{(row.subject as any)?.code}</p>
        </div>
      ),
    },
    {
      header: 'Section & Dept',
      render: (row) => {
        const sec = row.section as any;
        const deptCode = sec?.department?.code || sec?.department?.name;
        return (
          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
            <span>{sec?.name}</span>
            {deptCode && (
              <span className="px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 text-[10px] text-purple-700 font-mono font-bold">
                {deptCode}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Instructor',
      render: (row) => (
        <span className="text-xs text-slate-700 font-medium">{(row.teacher as any)?.name}</span>
      ),
    },
    {
      header: 'Roster Split',
      render: (row) => {
        const present = row.records?.filter((r) => r.status === 'present').length || 0;
        const late = row.records?.filter((r) => r.status === 'late').length || 0;
        const absent = row.records?.filter((r) => r.status === 'absent').length || 0;
        return (
          <div className="text-xs space-x-1 tabular-nums font-bold">
            <span className="text-emerald-600">{present}P</span> ·{' '}
            <span className="text-amber-600">{late}L</span> ·{' '}
            <span className="text-rose-600">{absent}A</span>
          </div>
        );
      },
    },
    {
      header: 'Marked Timestamp',
      render: (row) => (
        <span className="text-xs text-slate-500 tabular-nums">
          {formatDateTime(row.markedAt)}
        </span>
      ),
    },
    {
      header: 'Roster View',
      render: (row) => (
        <button
          onClick={() => {
            setSelectedRecord(row);
            setIsModalOpen(true);
          }}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
        >
          <Eye className="w-3.5 h-3.5 text-purple-600" />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {formatYearLabel(user?.year)} Attendance Audit Logs
          </h2>
          <p className="text-xs text-slate-500">
            Verifiable historical audit trail of attendance records submitted across all departments in {formatYearLabel(user?.year)}
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
            entityName="Attendance Audit"
            pdfExportUrl="/hod/attendance/export-pdf"
            pdfFilename={`Year_${user?.year || 1}_Attendance_Audit.pdf`}
            queryParams={deptFilter !== 'all' ? { department: deptFilter } : {}}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        searchPlaceholder="Search audit logs by subject, teacher, or section..."
        searchFilter={(row, q) =>
          ((row.subject as any)?.name?.toLowerCase().includes(q) ?? false) ||
          ((row.teacher as any)?.name?.toLowerCase().includes(q) ?? false) ||
          ((row.section as any)?.name?.toLowerCase().includes(q) ?? false) ||
          ((row.section as any)?.department?.code?.toLowerCase().includes(q) ?? false)
        }
      />

      {/* Inspect Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Session Attendance Roster"
        subtitle={`${(selectedRecord?.subject as any)?.name} · ${(selectedRecord?.section as any)?.name} · ${formatDate(selectedRecord?.date)}`}
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <p className="text-slate-500 font-medium">Marked By:</p>
              <p className="font-bold text-slate-900">{(selectedRecord?.teacher as any)?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500 font-medium">Marked At:</p>
              <p className="font-bold text-slate-900 tabular-nums">{formatDateTime(selectedRecord?.markedAt)}</p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {selectedRecord?.records?.map((rec: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-900">{rec.student?.name || 'Student'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{rec.student?.rollNumber}</p>
                </div>
                <StatusPill status={rec.status} />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
