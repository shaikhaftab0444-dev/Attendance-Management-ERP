import React from 'react';
import { Calendar, School, Building2, GraduationCap, ShieldCheck, AlertCircle } from 'lucide-react';
import { Course, Department, User, UserRole, AcademicSession } from '../../types';

export interface RoleScopeFieldsProps {
  role: UserRole;
  courses: Course[];
  departments: Department[];
  sessions?: AcademicSession[];
  users: User[];
  courseId: string;
  setCourseId: (courseId: string) => void;
  departmentId: string;
  setDepartmentId: (deptId: string) => void;
  year: number;
  setYear: (year: number) => void;
  sessionId?: string;
  setSessionId?: (sessionId: string) => void;
  teachingYears?: number[];
  setTeachingYears?: (years: number[]) => void;
  editingUserId?: string;
  disabled?: boolean;
}

export const RoleScopeFields: React.FC<RoleScopeFieldsProps> = ({
  role,
  courses,
  departments,
  sessions = [],
  users,
  courseId,
  setCourseId,
  departmentId,
  setDepartmentId,
  year,
  setYear,
  sessionId = '',
  setSessionId,
  teachingYears = [1],
  setTeachingYears,
  editingUserId,
  disabled = false,
}) => {
  const formatYearLabel = (y?: number) => {
    if (!y) return '—';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

  const selectedCourseObj = courses.find((c) => c._id === courseId);
  const maxYearsForCourse = selectedCourseObj ? selectedCourseObj.durationYears : 4;
  const courseYearsArray = Array.from({ length: maxYearsForCourse }, (_, i) => i + 1);

  if (role === 'admin') {
    return (
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800 block">Institution-Wide Scope</span>
          <span className="text-[11px] text-slate-500 block">
            System Administrators have global administrative access. No Course or Department scoping is required.
          </span>
        </div>
      </div>
    );
  }

  if (role === 'teacher') {
    const deptsForCourse = departments.filter((d) => (d.course?._id || d.course) === courseId);
    const availableYears = [1, 2, 3, 4];

    const toggleYear = (yr: number) => {
      if (disabled || !setTeachingYears) return;
      if (teachingYears.includes(yr)) {
        setTeachingYears(teachingYears.filter((y) => y !== yr));
      } else {
        setTeachingYears([...teachingYears, yr].sort((a, b) => a - b));
      }
    };

    return (
      <div className="space-y-4 p-3.5 bg-blue-50/40 rounded-xl border border-blue-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-blue-600" />
              <span>Course Program *</span>
            </label>
            <select
              value={courseId}
              disabled={disabled}
              onChange={(e) => {
                const newCourseId = e.target.value;
                setCourseId(newCourseId);
                const nextDepts = departments.filter((d) => (d.course?._id || d.course) === newCourseId);
                setDepartmentId(nextDepts[0]?._id || '');
              }}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60"
            >
              <option value="">Select Course Program...</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Home Department *</span>
            </label>
            <select
              value={departmentId}
              disabled={disabled || !courseId}
              onChange={(e) => setDepartmentId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">{courseId ? 'Select Department...' : 'Select Course First'}</option>
              {deptsForCourse.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Teaches Year(s) Multi-Select Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>Teaches Year(s) *</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {teachingYears.length === 0 ? (
                <span className="text-rose-600 font-semibold">Select at least one year</span>
              ) : (
                `${teachingYears.length} year${teachingYears.length > 1 ? 's' : ''} selected`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {availableYears.map((yr) => {
              const isSelected = teachingYears.includes(yr);
              return (
                <button
                  key={yr}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleYear(yr)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-white border-blue-200 text-slate-700 hover:bg-blue-50/60'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span>{formatYearLabel(yr)}</span>
                </button>
              );
            })}
          </div>
          {teachingYears.length === 0 && (
            <p className="text-[11px] text-rose-600 font-medium mt-1.5">
              Please select at least one academic year this teacher is eligible to teach.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (role === 'hod') {
    // Conflict check
    const conflictHod = users.find((u) => {
      if (u.role !== 'hod' || !u.isActive || (editingUserId && u._id === editingUserId)) return false;
      const uCourseId = typeof u.course === 'object' && u.course ? u.course._id : (u.course as string);
      const uSessionId = typeof u.session === 'object' && u.session ? u.session._id : (u.session as string);
      return uCourseId === courseId && uSessionId === sessionId && Number(u.year) === Number(year);
    });

    return (
      <div className="space-y-4 p-4 bg-purple-50/70 rounded-xl border border-purple-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Academic Session */}
          <div>
            <label className="block text-xs font-semibold text-purple-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-700" />
              <span>Academic Session *</span>
            </label>
            <select
              value={sessionId}
              disabled={disabled}
              onChange={(e) => setSessionId?.(e.target.value)}
              required
              className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 disabled:opacity-60"
            >
              <option value="">Select Session...</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.year} ({s.semesterLabel}){s.isActive ? ' - Active' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Course / Program */}
          <div>
            <label className="block text-xs font-semibold text-purple-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-purple-700" />
              <span>Course / Program *</span>
            </label>
            <select
              value={courseId}
              disabled={disabled}
              onChange={(e) => {
                const newCourseId = e.target.value;
                setCourseId(newCourseId);
                const nextDepts = departments.filter((d) => (d.course?._id || d.course) === newCourseId);
                setDepartmentId(nextDepts[0]?._id || '');
              }}
              required
              className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 disabled:opacity-60"
            >
              <option value="">Select Course...</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-purple-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-purple-700" />
              <span>Academic Year *</span>
            </label>
            <select
              value={year}
              disabled={disabled}
              onChange={(e) => setYear(Number(e.target.value))}
              required
              className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 disabled:opacity-60"
            >
              {courseYearsArray.map((yr) => (
                <option key={yr} value={yr}>
                  {formatYearLabel(yr)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Informative Scope Card */}
        {sessionId && courseId && (
          <div className="p-3 bg-white/90 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center gap-2">
            <span className="font-semibold text-purple-700">Assignment Scope:</span>
            <span>
              {formatYearLabel(year)} {courses.find((c) => c._id === courseId)?.name || 'Course'} HOD for Session{' '}
              {sessions.find((s) => s._id === sessionId)?.year || '—'} (
              {sessions.find((s) => s._id === sessionId)?.semesterLabel || '—'})
            </span>
          </div>
        )}

        {/* Existing Conflict Warning */}
        {conflictHod && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Notice: Existing Assignment</span>
              <span>
                {conflictHod.name} is already assigned as {formatYearLabel(year)} HOD for this Course & Session.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};
