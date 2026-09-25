import React from 'react';
import { School, Building2, GraduationCap, ShieldCheck } from 'lucide-react';
import { Course, Department, User, UserRole, Batch } from '../../types';

export interface RoleScopeFieldsProps {
  role: UserRole;
  courses: Course[];
  departments: Department[];
  users: User[];
  batches?: Batch[];
  courseId: string;
  setCourseId: (courseId: string) => void;
  departmentId: string;
  setDepartmentId: (deptId: string) => void;
  year: number;
  setYear: (year: number) => void;
  teachingYears?: number[];
  setTeachingYears?: (years: number[]) => void;
  assignedBatches?: string[];
  setAssignedBatches?: (batches: string[]) => void;
  editingUserId?: string;
  disabled?: boolean;
}

export const RoleScopeFields: React.FC<RoleScopeFieldsProps> = ({
  role,
  courses,
  departments,
  users,
  batches = [],
  courseId,
  setCourseId,
  departmentId,
  setDepartmentId,
  year,
  setYear,
  teachingYears = [1],
  setTeachingYears,
  assignedBatches = [],
  setAssignedBatches,
  editingUserId,
  disabled = false,
}) => {
  const formatYearLabel = (y?: number) => {
    if (!y) return '—';
    const suffix = y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th';
    return `${y}${suffix} Year`;
  };

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

        {/* Assigned Batches Multi-Select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Assigned Cohort Batches</span>
            </label>
            <span className="text-[11px] text-slate-500 font-medium">
              {assignedBatches.length === 0 ? (
                <span className="text-slate-500">All Course Batches (Default)</span>
              ) : (
                `${assignedBatches.length} batch${assignedBatches.length > 1 ? 'es' : ''} mapped`
              )}
            </span>
          </div>

          {(() => {
            const courseBatches = batches.filter(
              (b) => (b.course?._id || b.course) === courseId
            );

            if (courseBatches.length === 0) {
              return (
                <p className="text-xs text-slate-500 italic p-2 bg-white rounded-lg border border-dashed border-blue-200">
                  No cohort batches created for this course program yet.
                </p>
              );
            }

            const toggleBatch = (bId: string) => {
              if (disabled || !setAssignedBatches) return;
              if (assignedBatches.includes(bId)) {
                setAssignedBatches(assignedBatches.filter((id) => id !== bId));
              } else {
                setAssignedBatches([...assignedBatches, bId]);
              }
            };

            return (
              <div className="flex items-center gap-2 flex-wrap">
                {courseBatches.map((b) => {
                  const isSelected = assignedBatches.includes(b._id);
                  return (
                    <button
                      key={b._id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleBatch(b._id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-500/20'
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
                      <span>{b.name}</span>
                      {!b.isActive && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-normal">
                          Archived
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  if (role === 'hod') {
    const toggleBatch = (bId: string) => {
      if (disabled || !setAssignedBatches) return;
      if (assignedBatches.includes(bId)) {
        setAssignedBatches(assignedBatches.filter((id) => id !== bId));
      } else {
        setAssignedBatches([...assignedBatches, bId]);
      }
    };

    return (
      <div className="space-y-3 p-3.5 bg-purple-50/70 rounded-xl border border-purple-200/80">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-purple-700" />
            <span>Select Managed Batches / Cohorts *</span>
          </label>
          <span className="text-[11px] text-purple-700 font-medium">
            {assignedBatches.length === 0 ? (
              <span className="text-rose-600 font-semibold">Select at least one managed batch</span>
            ) : (
              `${assignedBatches.length} batch${assignedBatches.length > 1 ? 'es' : ''} assigned`
            )}
          </span>
        </div>

        {batches.length === 0 ? (
          <p className="text-xs text-purple-800 italic p-2 bg-white rounded-lg border border-dashed border-purple-300">
            No academic batches created yet. Please create batch cohorts first in the Batches tab.
          </p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {batches.map((b) => {
              const isSelected = assignedBatches.includes(b._id);
              const crs = typeof b.course === 'object' && b.course ? b.course : null;
              return (
                <button
                  key={b._id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleBatch(b._id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    isSelected
                      ? 'bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-500/20'
                      : 'bg-white border-purple-200 text-slate-700 hover:bg-purple-100/60'
                  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span>{b.name}</span>
                  {crs && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-purple-700 text-purple-100' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {crs.code}
                    </span>
                  )}
                  {!b.isActive && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-200 text-slate-700 font-normal">
                      Archived
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {assignedBatches.length === 0 && (
          <p className="text-[11px] text-rose-600 font-medium">
            HODs require at least one assigned cohort batch to manage curriculum, allocations, and attendance logs.
          </p>
        )}
      </div>
    );
  }

  return null;
};
