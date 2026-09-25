import React, { useEffect, useState } from 'react';
import { Calendar, Clock, BookOpen, Layers, Building2 } from 'lucide-react';
import api from '../../lib/api';
import { PeriodSlot } from '../../types';
import { ImportExportBar } from '../../components/ui/ImportExportBar';
import { useToast } from '../../context/ToastContext';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
];

export const TeacherTimetable: React.FC = () => {
  const [slots, setSlots] = useState<PeriodSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast } = useToast();

  const fetchTimetable = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/teacher/timetable/weekly');
      setSlots(res.data);
    } catch (err: any) {
      showToast(err.customMessage || 'Error fetching timetable', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-white border border-slate-200/80 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>My Weekly Teaching Schedule</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weekly timetable schedule showing your assigned lectures across all departments & sections
          </p>
        </div>
        <ImportExportBar
          entityName="Weekly Timetable"
          pdfExportUrl="/teacher/timetable/export-pdf"
          pdfFilename="My_Weekly_Timetable.pdf"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {DAYS.map((day) => {
          const daySlots = slots.filter((s) => s.dayOfWeek === day.id);
          return (
            <div key={day.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">{day.name}</h3>
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  {daySlots.length} {daySlots.length === 1 ? 'Period' : 'Periods'}
                </span>
              </div>

              {daySlots.length > 0 ? (
                <div className="space-y-2.5">
                  {daySlots.map((slot) => {
                    const deptName = slot.section?.department?.code || slot.section?.department?.name || 'Dept';
                    const batchName = (slot.batch as any)?.name || (slot.section?.batch as any)?.name || (slot.subject?.batch as any)?.name;
                    return (
                      <div
                        key={slot._id}
                        className="p-3 rounded-xl bg-teal-50/60 border border-teal-100 hover:bg-teal-50 hover:border-teal-200 transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-teal-800 px-2 py-0.5 rounded bg-teal-100/80 border border-teal-200/80">
                            Period #{slot.periodNumber}
                          </span>
                          <span className="font-mono text-slate-500 text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>

                        <p className="font-bold text-slate-900 text-sm line-clamp-1">{slot.subject?.name}</p>

                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-teal-800 border border-teal-200/60 flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5 text-teal-600" />
                            {deptName}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5 text-slate-400" />
                            {slot.section?.name} · Year {slot.section?.year || 1}
                          </span>
                          {batchName && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1 font-mono">
                              Batch {batchName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  No classes scheduled on this day
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
