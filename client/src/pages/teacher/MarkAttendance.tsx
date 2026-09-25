import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Layers,
  CalendarOff,
} from 'lucide-react';
import api from '../../lib/api';
import { PeriodSlot, Student } from '../../types';
import { useToast } from '../../context/ToastContext';

export const TeacherMarkAttendance: React.FC = () => {
  const [todaySlots, setTodaySlots] = useState<PeriodSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PeriodSlot | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [isMarked, setIsMarked] = useState(false);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [editWindowHours, setEditWindowHours] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Holiday state
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchTodaySlots = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/teacher/timetable/today');
      if (res.data.isHoliday) {
        setIsHoliday(true);
        setHolidayName(res.data.holidayName);
        setTodaySlots(res.data.slots || []);
        if (res.data.slots?.length > 0) {
          setSelectedSlot(res.data.slots[0]);
        }
      } else if (Array.isArray(res.data)) {
        setIsHoliday(false);
        setTodaySlots(res.data);
        if (res.data.length > 0) {
          setSelectedSlot(res.data[0]);
        }
      }
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching today schedule', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTodaySlots();
  }, []);

  const fetchRoster = async (slotId: string) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/teacher/period/${slotId}/students`);
      setStudents(res.data.students);
      setIsMarked(res.data.isMarked);
      setAttendanceId(res.data.attendance?._id || null);
      setCanEdit(res.data.canEdit);
      setEditWindowHours(res.data.editWindowHours || 24);

      if (res.data.isHoliday) {
        setIsHoliday(true);
        setHolidayName(res.data.holidayName);
      }

      if (res.data.attendance && res.data.attendance.records) {
        const initialRecords: Record<string, 'present' | 'absent' | 'late'> = {};
        res.data.attendance.records.forEach((r: any) => {
          const sId = r.student?._id || r.student;
          initialRecords[sId] = r.status;
        });
        setRecords(initialRecords);
      } else {
        const defaultRecords: Record<string, 'present' | 'absent' | 'late'> = {};
        res.data.students.forEach((s: Student) => {
          defaultRecords[s._id] = 'present';
        });
        setRecords(defaultRecords);
      }
    } catch (err: any) {
      showToast(err.customMessage || 'Error loading class roster', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSlot) {
      fetchRoster(selectedSlot._id);
    }
  }, [selectedSlot]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late') => {
    if (isMarked && !canEdit) {
      showToast('Edit window has expired for this attendance session.', 'warning');
      return;
    }
    setRecords((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAllPresent = () => {
    if (isMarked && !canEdit) return;
    const allP: Record<string, 'present' | 'absent' | 'late'> = {};
    students.forEach((s) => {
      allP[s._id] = 'present';
    });
    setRecords(allP);
    showToast('All students marked as Present', 'info');
  };

  const handleSubmit = async () => {
    if (isHoliday) {
      showToast(`Cannot mark attendance on ${holidayName}. No attendance required.`, 'warning');
      return;
    }

    if (!selectedSlot) return;
    const recordArray = Object.entries(records).map(([student, status]) => ({
      student,
      status,
    }));

    if (recordArray.length !== students.length) {
      showToast('Incomplete records. Please set attendance status for all students.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isMarked && attendanceId) {
        await api.patch(`/teacher/attendance/${attendanceId}`, {
          records: recordArray,
        });
        showToast('Attendance updated successfully', 'success');
      } else {
        await api.post('/teacher/attendance', {
          periodSlotId: selectedSlot._id,
          records: recordArray,
        });
        showToast('Attendance recorded successfully', 'success');
      }
      fetchTodaySlots();
      if (selectedSlot) fetchRoster(selectedSlot._id);
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to submit attendance', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presentCount = Object.values(records).filter((v) => v === 'present').length;
  const lateCount = Object.values(records).filter((v) => v === 'late').length;
  const absentCount = Object.values(records).filter((v) => v === 'absent').length;

  const deptName = selectedSlot?.section?.department?.code || selectedSlot?.section?.department?.name || 'Department';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-600" />
            <span>Attendance Marking & Verification Pad</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time daily attendance recording for your scheduled lectures
          </p>
        </div>

        {/* Running Counts Badge */}
        <div className="flex items-center gap-3 bg-white border border-slate-200/80 shadow-sm px-4 py-2 rounded-xl text-xs font-semibold shrink-0">
          <span className="text-emerald-600 font-bold">{presentCount} Present</span>
          <span className="text-slate-300">·</span>
          <span className="text-amber-600 font-bold">{lateCount} Late</span>
          <span className="text-slate-300">·</span>
          <span className="text-rose-600 font-bold">{absentCount} Absent</span>
        </div>
      </div>

      {/* Holiday Alert if active */}
      {isHoliday && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800 text-xs">
          <CalendarOff className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Official Holiday:</strong> Today is <strong>{holidayName}</strong>. Lecture attendance is not required today and marking has been disabled.
          </span>
        </div>
      )}

      {/* Period Selection Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {todaySlots.map((slot) => {
          const isSelected = selectedSlot?._id === slot._id;
          const slotDept = slot.section?.department?.code || slot.section?.department?.name || 'Dept';
          return (
            <button
              key={slot._id}
              onClick={() => setSelectedSlot(slot)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'gradient-btn shadow-md text-white border-transparent'
                  : slot.isMarked
                  ? 'bg-emerald-50/80 border-emerald-200 text-slate-800 hover:bg-emerald-100/60'
                  : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold">Period #{slot.periodNumber}</span>
                <span className={`text-[11px] font-mono ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                  {slot.startTime}
                </span>
              </div>
              <p className="font-semibold text-sm line-clamp-1">{slot.subject?.name}</p>
              <div className={`text-[11px] mt-1 flex items-center gap-1.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                <span className="font-semibold">{slotDept}</span>
                <span>·</span>
                <span>{slot.section?.name} (Yr {slot.section?.year || 1})</span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSlot ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
          {/* Slot Details Banner with Department + Year */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-bold text-slate-900 text-base">{selectedSlot.subject?.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 font-semibold">
                  {deptName}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-200/70 border border-slate-300 text-slate-700">
                  {selectedSlot.section?.name} · Year {selectedSlot.section?.year || 1}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Period #{selectedSlot.periodNumber} ({selectedSlot.startTime} - {selectedSlot.endTime}) · {students.length} Enrolled
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {!isHoliday && (!isMarked || canEdit) && (
                <button
                  type="button"
                  onClick={markAllPresent}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm transition-colors"
                >
                  Mark All Present
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || (isMarked && !canEdit) || isHoliday}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-teal-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <span>{isMarked ? 'Update Attendance' : 'Submit Attendance'}</span>
              </button>
            </div>
          </div>

          {/* Student Attendance List */}
          <div className="w-full md:rounded-xl md:border md:border-slate-200/80 md:bg-white md:overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse block md:table">
              <thead className="hidden md:table-header-group bg-slate-50 text-slate-600 text-[11px] md:text-xs uppercase tracking-wider border-b border-slate-200">
                <tr className="md:table-row">
                  <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold whitespace-nowrap">Roll No</th>
                  <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold whitespace-nowrap">Student Name</th>
                  <th className="py-3 px-3.5 md:py-3.5 md:px-4 font-semibold text-center whitespace-nowrap">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group space-y-3 md:space-y-0 divide-y-0 md:divide-y md:divide-slate-100">
                {students.map((student) => {
                  const currentStatus = records[student._id] || 'present';
                  return (
                    <tr
                      key={student._id}
                      className="block bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2.5 md:space-y-0 md:p-0 md:border-0 md:rounded-none md:shadow-none md:table-row hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="flex items-center justify-between md:table-cell py-0 md:py-3.5 md:px-4 font-mono font-semibold text-xs text-slate-600">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider md:hidden">Roll No</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">{student.rollNumber}</span>
                      </td>
                      <td className="flex items-center justify-between md:table-cell py-0 md:py-3.5 md:px-4 font-medium text-slate-900 text-xs md:text-sm">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider md:hidden">Student</span>
                        <span className="font-semibold text-slate-900">{student.name}</span>
                      </td>
                      <td className="pt-2 border-t border-slate-100 md:border-t-0 md:pt-0 md:table-cell md:py-3.5 md:px-4">
                        <div className="grid grid-cols-3 sm:flex sm:items-center sm:justify-center gap-1.5 w-full">
                          {/* Present Toggle */}
                          <button
                            type="button"
                            disabled={isHoliday || (isMarked && !canEdit)}
                            onClick={() => handleStatusChange(student._id, 'present')}
                            className={`py-2 px-3 md:py-1 rounded-xl md:rounded-lg text-xs font-semibold transition-all text-center ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Present
                          </button>

                          {/* Late Toggle */}
                          <button
                            type="button"
                            disabled={isHoliday || (isMarked && !canEdit)}
                            onClick={() => handleStatusChange(student._id, 'late')}
                            className={`py-2 px-3 md:py-1 rounded-xl md:rounded-lg text-xs font-semibold transition-all text-center ${
                              currentStatus === 'late'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Late
                          </button>

                          {/* Absent Toggle */}
                          <button
                            type="button"
                            disabled={isHoliday || (isMarked && !canEdit)}
                            onClick={() => handleStatusChange(student._id, 'absent')}
                            className={`py-2 px-3 md:py-1 rounded-xl md:rounded-lg text-xs font-semibold transition-all text-center ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center text-slate-500 text-xs rounded-2xl border border-slate-200/80 shadow-sm">
          No lecture scheduled for you today.
        </div>
      )}
    </div>
  );
};
