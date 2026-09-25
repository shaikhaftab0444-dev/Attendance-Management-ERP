import React, { useEffect, useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  Building2,
  GraduationCap,
  Layers,
  Coffee,
  School,
  Edit2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import api from '../../lib/api';
import { Department, Section, Subject, User as UserType, AcademicSession, PeriodSlot, Course, PeriodTemplate } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const DEFAULT_TIMINGS: Record<number, { start: string; end: string }> = {
  1: { start: '09:00', end: '10:00' },
  2: { start: '10:15', end: '11:15' },
  3: { start: '11:30', end: '12:30' },
  4: { start: '13:30', end: '14:30' },
  5: { start: '14:45', end: '15:45' },
  6: { start: '16:00', end: '17:00' },
  7: { start: '17:15', end: '18:15' },
  8: { start: '18:30', end: '19:30' },
};

export const AdminTimetable: React.FC = () => {
  // Cascading Filters
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');

  // Loaded Data
  const [slots, setSlots] = useState<PeriodSlot[]>([]);
  const [periodTemplates, setPeriodTemplates] = useState<PeriodTemplate[]>([]);
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<UserType[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Scoped Faculty Toggle (Part C)
  const [showAllFaculty, setShowAllFaculty] = useState<boolean>(false);

  // Modal State for Period Slots
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PeriodSlot | null>(null);
  const [modalDay, setModalDay] = useState<number>(1);
  const [modalPeriod, setModalPeriod] = useState<number>(1);
  const [modalSubject, setModalSubject] = useState<string>('');
  const [modalTeacher, setModalTeacher] = useState<string>('');
  const [modalStartTime, setModalStartTime] = useState<string>('09:00');
  const [modalEndTime, setModalEndTime] = useState<string>('10:00');
  const [modalIsRecess, setModalIsRecess] = useState<boolean>(false);
  const [modalRecessLabel, setModalRecessLabel] = useState<string>('Lunch Break');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Row Header Timing Modal State (Part B)
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [editingTemplatePeriod, setEditingTemplatePeriod] = useState<number>(1);
  const [timingModalStartTime, setTimingModalStartTime] = useState<string>('09:00');
  const [timingModalEndTime, setTimingModalEndTime] = useState<string>('10:00');
  const [isUpdatingTiming, setIsUpdatingTiming] = useState(false);

  // Inconsistency Repair Modal State (Part B)
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [activeInconsistency, setActiveInconsistency] = useState<any>(null);
  const [resolveStartTime, setResolveStartTime] = useState<string>('');
  const [resolveEndTime, setResolveEndTime] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);

  const { showToast } = useToast();

  const RECESS_PRESETS = ['Lunch Break', 'Short Recess', 'Tea Break', 'Interval'];

  // 1. Initial Load: Courses, Departments, Sections, Sessions
  const fetchInitialData = async () => {
    try {
      const [crsRes, deptRes, secRes, sesRes] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/departments'),
        api.get('/admin/sections'),
        api.get('/admin/sessions'),
      ]);

      setCourses(crsRes.data);
      setDepartments(deptRes.data);
      setAllSections(secRes.data);
      setSessions(sesRes.data);

      if (crsRes.data.length > 0) {
        setSelectedCourse(crsRes.data[0]._id);
      }

      if (deptRes.data.length > 0) {
        const firstDept = deptRes.data[0]._id;
        setSelectedDept(firstDept);

        const matching = secRes.data.filter(
          (s: any) => (s.department?._id || s.department) === firstDept && (s.year || 1) === 1
        );
        if (matching.length > 0) {
          setSelectedSection(matching[0]._id);
        } else if (secRes.data.length > 0) {
          setSelectedSection(secRes.data[0]._id);
        }
      }
    } catch (err: any) {
      showToast(err.customMessage || 'Error loading timetable data', 'error');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch scoped or all teachers based on showAllFaculty & selectedCourse/selectedDept/selectedYear
  const fetchTeachers = async () => {
    try {
      const params: any = {};
      if (showAllFaculty) {
        params.all = true;
      } else {
        if (selectedCourse) params.course = selectedCourse;
        if (selectedDept) params.department = selectedDept;
        if (selectedYear) params.year = selectedYear;
      }
      const res = await api.get('/admin/teachers-for-course', { params });
      setTeachers(res.data);
    } catch (err) {
      console.error('Error loading teachers:', err);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, [selectedCourse, selectedDept, selectedYear, showAllFaculty]);

  // Filter departments by selectedCourse
  const filteredDepartments = useMemo(() => {
    if (!selectedCourse) return departments;
    return departments.filter((d) => {
      const cId = typeof d.course === 'object' && d.course ? d.course._id : d.course;
      return cId === selectedCourse;
    });
  }, [departments, selectedCourse]);

  // When selectedCourse changes, keep selectedDept in sync
  useEffect(() => {
    if (filteredDepartments.length > 0) {
      const exists = filteredDepartments.find((d) => d._id === selectedDept);
      if (!exists) {
        setSelectedDept(filteredDepartments[0]._id);
      }
    } else {
      setSelectedDept('');
    }
  }, [filteredDepartments]);

  const selectedCourseObj = courses.find((c) => c._id === selectedCourse);
  const maxYearsForCourse = selectedCourseObj ? selectedCourseObj.durationYears : 4;
  const courseYearsArray = Array.from({ length: maxYearsForCourse }, (_, i) => i + 1);

  // Filter sections by department and year
  const filteredSections = useMemo(() => {
    return allSections.filter((s) => {
      const dId = (s.department as any)?._id || s.department;
      const yr = s.year || 1;
      const deptMatches = !selectedDept || dId === selectedDept;
      const yearMatches = !selectedYear || yr === Number(selectedYear);
      return deptMatches && yearMatches;
    });
  }, [allSections, selectedDept, selectedYear]);

  // Keep selectedSection valid when filter changes
  useEffect(() => {
    if (filteredSections.length > 0) {
      const exists = filteredSections.find((s) => s._id === selectedSection);
      if (!exists) {
        setSelectedSection(filteredSections[0]._id);
      }
    } else {
      setSelectedSection('');
    }
  }, [filteredSections]);

  // 2. Fetch Slots, Templates, Inconsistencies & Department Subjects when section changes
  const fetchSectionTimetable = async () => {
    if (!selectedSection) {
      setSlots([]);
      setPeriodTemplates([]);
      setInconsistencies([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [slotRes, subRes, tplRes, incRes] = await Promise.all([
        api.get('/admin/period-slots', { params: { section: selectedSection } }),
        api.get('/admin/subjects', { params: { department: selectedDept } }),
        api.get('/admin/period-templates', { params: { section: selectedSection } }),
        api.get('/admin/period-slots/inconsistencies', { params: { section: selectedSection } }),
      ]);
      setSlots(slotRes.data);
      setSubjects(subRes.data);
      setPeriodTemplates(tplRes.data);
      setInconsistencies(incRes.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching timetable grid', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSectionTimetable();
  }, [selectedSection, selectedDept]);

  // Template Map: periodNumber -> PeriodTemplate
  const templateMap = useMemo(() => {
    const map = new Map<number, PeriodTemplate>();
    periodTemplates.forEach((t) => {
      map.set(Number(t.periodNumber), t);
    });
    return map;
  }, [periodTemplates]);

  // Grid Map: `day_period` -> PeriodSlot
  const slotMap = useMemo(() => {
    const map = new Map<string, PeriodSlot>();
    slots.forEach((s) => {
      map.set(`${s.dayOfWeek}_${s.periodNumber}`, s);
    });
    return map;
  }, [slots]);

  // Open modal to create slot in a cell
  const handleCellAdd = (day: number, period: number) => {
    setEditingSlot(null);
    setModalDay(day);
    setModalPeriod(period);
    setModalSubject(subjects[0]?._id || '');
    setModalTeacher(teachers[0]?._id || '');
    setModalIsRecess(false);
    setModalRecessLabel('Lunch Break');

    // Use existing PeriodTemplate timing if available, otherwise default
    const existingTemplate = templateMap.get(period);
    if (existingTemplate) {
      setModalStartTime(existingTemplate.startTime);
      setModalEndTime(existingTemplate.endTime);
    } else {
      const defaultTiming = DEFAULT_TIMINGS[period] || { start: '09:00', end: '10:00' };
      setModalStartTime(defaultTiming.start);
      setModalEndTime(defaultTiming.end);
    }

    setIsModalOpen(true);
  };

  // Open modal to edit existing slot
  const handleCellEdit = (slot: PeriodSlot) => {
    setEditingSlot(slot);
    setModalDay(slot.dayOfWeek);
    setModalPeriod(slot.periodNumber);
    setModalSubject((slot.subject as any)?._id || slot.subject || '');
    setModalTeacher((slot.teacher as any)?._id || slot.teacher || '');
    setModalIsRecess(!!slot.isRecess);
    setModalRecessLabel(slot.recessLabel || 'Lunch Break');

    const existingTemplate = templateMap.get(slot.periodNumber);
    if (existingTemplate) {
      setModalStartTime(existingTemplate.startTime);
      setModalEndTime(existingTemplate.endTime);
    } else {
      setModalStartTime(slot.startTime);
      setModalEndTime(slot.endTime);
    }

    setIsModalOpen(true);
  };

  // Open row header timing modal
  const handleOpenTimingModal = (periodNumber: number) => {
    setEditingTemplatePeriod(periodNumber);
    const existing = templateMap.get(periodNumber);
    if (existing) {
      setTimingModalStartTime(existing.startTime);
      setTimingModalEndTime(existing.endTime);
    } else {
      const def = DEFAULT_TIMINGS[periodNumber] || { start: '09:00', end: '10:00' };
      setTimingModalStartTime(def.start);
      setTimingModalEndTime(def.end);
    }
    setIsTimingModalOpen(true);
  };

  // Save template timing change
  const handleSaveTimingModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection) return;

    setIsUpdatingTiming(true);
    try {
      const res = await api.put('/admin/period-templates', {
        section: selectedSection,
        periodNumber: editingTemplatePeriod,
        startTime: timingModalStartTime,
        endTime: timingModalEndTime,
      });
      showToast(res.data?.message || `Period #${editingTemplatePeriod} timings updated`, 'success');
      setIsTimingModalOpen(false);
      fetchSectionTimetable();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to update period template timings', 'error');
    } finally {
      setIsUpdatingTiming(false);
    }
  };

  // Open inconsistency resolution modal
  const handleOpenResolveModal = (inc: any) => {
    setActiveInconsistency(inc);
    if (inc.variants && inc.variants.length > 0) {
      setResolveStartTime(inc.variants[0].startTime);
      setResolveEndTime(inc.variants[0].endTime);
    }
    setIsResolveModalOpen(true);
  };

  const handleResolveInconsistency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInconsistency || !resolveStartTime || !resolveEndTime) return;

    setIsResolving(true);
    try {
      const res = await api.post('/admin/period-slots/resolve-inconsistency', {
        sectionId: activeInconsistency.sectionId,
        periodNumber: activeInconsistency.periodNumber,
        canonicalStartTime: resolveStartTime,
        canonicalEndTime: resolveEndTime,
      });
      showToast(res.data?.message || 'Inconsistency resolved successfully', 'success');
      setIsResolveModalOpen(false);
      fetchSectionTimetable();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to resolve timing inconsistency', 'error');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSection) {
      showToast('Please select a section.', 'warning');
      return;
    }

    if (!modalIsRecess && (!modalSubject || !modalTeacher)) {
      showToast('Please select both Course Subject and Faculty.', 'warning');
      return;
    }

    if (modalIsRecess && !modalRecessLabel.trim()) {
      showToast('Please enter a recess label.', 'warning');
      return;
    }

    const secDoc = allSections.find((s) => s._id === selectedSection);
    const activeSession = sessions.find((s) => s.isActive) || sessions[0];
    const sessionId = (secDoc?.session as any)?._id || secDoc?.session || activeSession?._id;

    const payload: any = {
      section: selectedSection,
      dayOfWeek: modalDay,
      periodNumber: modalPeriod,
      startTime: modalStartTime,
      endTime: modalEndTime,
      session: sessionId,
      isRecess: modalIsRecess,
      recessLabel: modalIsRecess ? modalRecessLabel.trim() : '',
      subject: modalIsRecess ? null : modalSubject,
      teacher: modalIsRecess ? null : modalTeacher,
    };

    setIsSubmitting(true);
    try {
      if (editingSlot) {
        await api.patch(`/admin/period-slots/${editingSlot._id}`, payload);
        showToast('Timetable slot updated successfully', 'success');
      } else {
        await api.post('/admin/period-slots', payload);
        showToast(modalIsRecess ? 'Recess slot scheduled successfully' : 'Timetable slot scheduled successfully', 'success');
      }
      setIsModalOpen(false);
      fetchSectionTimetable();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to schedule slot', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!editingSlot) return;
    if (!window.confirm('Delete this scheduled period?')) return;

    try {
      await api.delete(`/admin/period-slots/${editingSlot._id}`);
      showToast('Period slot deleted', 'success');
      setIsModalOpen(false);
      fetchSectionTimetable();
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to delete slot', 'error');
    }
  };

  const currentSectionDoc = allSections.find((s) => s._id === selectedSection);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <span>Master Timetable Builder</span>
          </h2>
          <p className="text-xs text-slate-500">
            Year-wise & Department-wise visual timetable schedule with real-time teacher conflict prevention
          </p>
        </div>

        <ImportExportBar
          entityName="Master Timetable"
          exportUrl="/admin/period-slots/export"
          pdfExportUrl={selectedSection ? '/admin/period-slots/export-timetable-pdf' : undefined}
          pdfFilename="weekly_timetable.pdf"
          importUrl="/admin/period-slots/import"
          onImportSuccess={fetchSectionTimetable}
          exportFilename="master_timetable.csv"
          queryParams={{
            course: selectedCourse,
            department: selectedDept,
            year: selectedYear,
            section: selectedSection,
          }}
        />
      </div>

      {/* Cascading Filter Bar: Course -> Department -> Year -> Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Course Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-indigo-600" />
            <span>1. Course Program *</span>
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Department Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>2. Department *</span>
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            {filteredDepartments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        {/* Year Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>3. Academic Year *</span>
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          >
            {courseYearsArray.map((y) => (
              <option key={y} value={y}>
                {y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year
              </option>
            ))}
          </select>
        </div>

        {/* Section Picker */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>4. Class Section *</span>
          </label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            disabled={filteredSections.length === 0}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 disabled:opacity-40 font-medium"
          >
            {filteredSections.length > 0 ? (
              filteredSections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} (Sem {s.semester})
                </option>
              ))
            ) : (
              <option value="">No sections found in this year</option>
            )}
          </select>
        </div>
      </div>

      {/* Consistency Repair Banner (Part B) */}
      {inconsistencies.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-950">
                Timing Inconsistencies Detected ({inconsistencies.length})
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Certain periods have different start/end times across scheduled days. Standardize them into a consistent schedule.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {inconsistencies.map((inc) => (
              <button
                key={inc.periodNumber}
                type="button"
                onClick={() => handleOpenResolveModal(inc)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Fix Period #{inc.periodNumber} Mismatch</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timetable Weekly Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">
                Weekly Timetable: {currentSectionDoc?.name || 'Select Section'}
              </h3>
              {currentSectionDoc?.batch && (
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold text-xs">
                  {typeof currentSectionDoc.batch === 'object' ? currentSectionDoc.batch.name : currentSectionDoc.batch} Batch
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Click any slot to edit/delete, click &apos;+&apos; in an empty cell to schedule, or click the pencil icon next to Period # to change timing for all days.
            </p>
          </div>
          <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Total Periods Scheduled: <strong className="text-slate-900 tabular-nums">{slots.length}</strong>
          </span>
        </div>

        {selectedSection ? (
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[800px] text-left border-collapse text-xs md:text-sm">
              <thead className="bg-slate-50 text-slate-700 text-[11px] md:text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-32 text-center font-bold text-slate-500 border-r border-slate-200 whitespace-nowrap">
                    Period #
                  </th>
                  {DAYS.map((day) => (
                    <th key={day.id} className="p-3 text-center font-bold border-r border-slate-200 last:border-r-0 whitespace-nowrap">
                      {day.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERIOD_NUMBERS.map((pNum) => {
                  const tpl = templateMap.get(pNum);
                  const displayStart = tpl?.startTime || DEFAULT_TIMINGS[pNum]?.start || '09:00';
                  const displayEnd = tpl?.endTime || DEFAULT_TIMINGS[pNum]?.end || '10:00';

                  return (
                    <tr key={pNum} className="hover:bg-slate-50/50 transition-colors">
                      {/* Period Label Column with Edit Pencil Icon */}
                      <td className="p-3 text-center bg-slate-50/70 border-r border-slate-200 shrink-0">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 font-mono">#{pNum}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenTimingModal(pNum)}
                            title={`Edit timing for Period #${pNum} across all days`}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-600 font-mono font-medium mt-0.5">
                          {displayStart} - {displayEnd}
                        </p>
                        {tpl && (
                          <span className="inline-block text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full mt-1">
                            Fixed Time
                          </span>
                        )}
                      </td>

                      {/* Day Columns */}
                      {DAYS.map((day) => {
                        const slot = slotMap.get(`${day.id}_${pNum}`);
                        return (
                          <td
                            key={day.id}
                            className="p-2 border-r border-slate-200 last:border-r-0 h-24 align-top"
                          >
                            {slot ? (
                              slot.isRecess ? (
                                <button
                                  type="button"
                                  onClick={() => handleCellEdit(slot)}
                                  className="w-full h-full p-2.5 rounded-xl bg-amber-50/90 hover:bg-amber-100/90 border border-amber-200 text-left transition-all group flex flex-col justify-between shadow-sm"
                                >
                                  <div className="flex items-center gap-1.5 text-amber-800">
                                    <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="font-bold text-xs line-clamp-1 group-hover:text-amber-950">
                                      {slot.recessLabel || 'Recess / Break'}
                                    </span>
                                  </div>

                                  <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between text-[10px]">
                                    <span className="text-amber-700/80 font-medium">Recess Break</span>
                                    <span className="text-amber-800 font-mono font-bold">
                                      {slot.startTime}
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCellEdit(slot)}
                                  className="w-full h-full p-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-left transition-all group flex flex-col justify-between shadow-sm"
                                >
                                  <div>
                                    <p className="font-bold text-xs text-blue-900 line-clamp-1 group-hover:text-blue-950">
                                      {slot.subject?.name}
                                    </p>
                                    <p className="text-[10px] text-blue-700 font-mono mt-0.5">
                                      {slot.subject?.code}
                                    </p>
                                  </div>

                                  <div className="pt-1.5 border-t border-blue-200/60 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-700 font-semibold truncate">
                                      {slot.teacher?.name}
                                    </span>
                                    <span className="text-blue-700 font-mono font-bold">
                                      {slot.startTime}
                                    </span>
                                  </div>
                                </button>
                              )
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleCellAdd(day.id, pNum)}
                                className="w-full h-full rounded-xl border border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all group"
                                title={`Add period for ${day.name} #${pNum}`}
                              >
                                <Plus className="w-4 h-4 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            Please select a Department, Year, and Section above to view or construct its timetable grid.
          </div>
        )}
      </div>

      {/* Schedule / Edit Period Slot Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? (modalIsRecess ? 'Edit Recess Slot' : 'Edit Scheduled Period') : (modalIsRecess ? 'Schedule Recess / Break' : 'Schedule Class Period')}
        subtitle={`${DAYS.find((d) => d.id === modalDay)?.name} · Period #${modalPeriod} · ${currentSectionDoc?.name}`}
      >
        <form onSubmit={handleSaveSlot} className="space-y-4">
          {/* Recess Toggle */}
          <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-600" />
              <div>
                <span className="text-xs font-semibold text-amber-900 block">Recess / Break Period</span>
                <span className="text-[11px] text-amber-700/80 block">No subject or faculty required</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={modalIsRecess}
                onChange={(e) => setModalIsRecess(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {modalIsRecess ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Recess Label *
              </label>
              <input
                type="text"
                value={modalRecessLabel}
                onChange={(e) => setModalRecessLabel(e.target.value)}
                placeholder="e.g. Lunch Break"
                required={modalIsRecess}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium">Quick pick:</span>
                {RECESS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setModalRecessLabel(preset)}
                    className={`px-2 py-0.5 text-[11px] rounded-lg font-medium border transition-colors ${
                      modalRecessLabel === preset
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Course Subject *
                </label>
                <select
                  value={modalSubject}
                  onChange={(e) => setModalSubject(e.target.value)}
                  required={!modalIsRecess}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code}) - Sem {s.semester}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Assigned Faculty *
                </label>
                <select
                  value={modalTeacher}
                  onChange={(e) => setModalTeacher(e.target.value)}
                  required={!modalIsRecess}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  {teachers.map((t) => {
                    const deptName = (t.department as any)?.name || (t.department as any)?.code || 'Campus Faculty';
                    return (
                      <option key={t._id} value={t._id}>
                        {t.name} ({deptName}) {t.employeeId ? `[${t.employeeId}]` : ''}
                      </option>
                    );
                  })}
                </select>

                {/* Part C: Show All Faculty Checkbox */}
                <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAllFaculty}
                    onChange={(e) => setShowAllFaculty(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600 font-medium">
                    Show all faculty (including other courses & departments)
                  </span>
                </label>
              </div>
            </>
          )}

          {/* Start and End Time (Fixed timing if template exists) */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={modalStartTime}
                  disabled={templateMap.has(modalPeriod)}
                  onChange={(e) => setModalStartTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={modalEndTime}
                  disabled={templateMap.has(modalPeriod)}
                  onChange={(e) => setModalEndTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {templateMap.has(modalPeriod) ? (
              <p className="text-[11px] text-slate-500 italic">
                Period timing is fixed for this section. Click the pencil icon on the Period #{modalPeriod} row header in the grid to change timing for all days.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                Scheduling this period will establish standard timing for Period #{modalPeriod} across all days for this section.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {editingSlot ? (
              <button
                type="button"
                onClick={handleDeleteSlot}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete Slot</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
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
                <span>{editingSlot ? 'Update Period' : 'Schedule Period'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Row Header Period Timing Edit Modal (Part B) */}
      <Modal
        isOpen={isTimingModalOpen}
        onClose={() => setIsTimingModalOpen(false)}
        title={`Edit Period #${editingTemplatePeriod} Standard Timing`}
        subtitle={`Applies to all scheduled days for ${currentSectionDoc?.name || 'this section'}`}
      >
        <form onSubmit={handleSaveTimingModal} className="space-y-4">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              Updating these timings will update the standard template and automatically synchronize all existing <strong>Period #{editingTemplatePeriod}</strong> timetable slots for <strong>{currentSectionDoc?.name}</strong> across Monday through Saturday.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Start Time *
              </label>
              <input
                type="time"
                value={timingModalStartTime}
                onChange={(e) => setTimingModalStartTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                End Time *
              </label>
              <input
                type="time"
                value={timingModalEndTime}
                onChange={(e) => setTimingModalEndTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsTimingModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdatingTiming}
              className="px-5 py-2 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 text-white shadow-sm"
            >
              {isUpdatingTiming && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>Apply to All Days</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Inconsistency Resolution Modal (Part B) */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title={`Resolve Timing Mismatch: Period #${activeInconsistency?.periodNumber}`}
        subtitle={`Section ${activeInconsistency?.sectionName}`}
      >
        <form onSubmit={handleResolveInconsistency} className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <p className="font-semibold mb-1">Conflicting timings detected across scheduled days:</p>
            <div className="space-y-1.5 mt-2">
              {activeInconsistency?.variants?.map((v: any, idx: number) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                    resolveStartTime === v.startTime && resolveEndTime === v.endTime
                      ? 'bg-amber-100/80 border-amber-400 font-semibold'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="canonicalTiming"
                      checked={resolveStartTime === v.startTime && resolveEndTime === v.endTime}
                      onChange={() => {
                        setResolveStartTime(v.startTime);
                        setResolveEndTime(v.endTime);
                      }}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <span className="font-mono text-xs">{v.startTime} - {v.endTime}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {v.days?.join(', ')} ({v.count} slot{v.count > 1 ? 's' : ''})
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Canonical Start Time *
              </label>
              <input
                type="time"
                value={resolveStartTime}
                onChange={(e) => setResolveStartTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Canonical End Time *
              </label>
              <input
                type="time"
                value={resolveEndTime}
                onChange={(e) => setResolveEndTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsResolveModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isResolving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-2"
            >
              {isResolving && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              <span>Unify Timing for All Days</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
