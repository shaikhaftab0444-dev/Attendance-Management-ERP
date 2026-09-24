import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowRight,
  CalendarOff,
  Building2,
  Layers,
} from 'lucide-react';
import api from '../../lib/api';
import { StatCard } from '../../components/ui/StatCard';
import { PeriodSlot } from '../../types';

export const TeacherDashboard: React.FC = () => {
  const [todaySlots, setTodaySlots] = useState<PeriodSlot[]>([]);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState<string | null>(null);
  const [reportSummary, setReportSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [todayRes, repRes] = await Promise.all([
        api.get('/teacher/timetable/today'),
        api.get('/teacher/reports/my-subjects'),
      ]);

      if (todayRes.data.isHoliday) {
        setIsHoliday(true);
        setHolidayName(todayRes.data.holidayName);
        setTodaySlots(todayRes.data.slots || []);
      } else if (Array.isArray(todayRes.data)) {
        setIsHoliday(false);
        setTodaySlots(todayRes.data);
      }

      setReportSummary(repRes.data.summary);
    } catch (err) {
      console.error('Error fetching teacher dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white border border-slate-200" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white border border-slate-200" />
      </div>
    );
  }

  const markedCount = todaySlots.filter((s) => s.isMarked).length;
  const totalToday = todaySlots.length;

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          title="Today's Teaching Load"
          value={`${markedCount} / ${totalToday}`}
          subtitle="Class periods logged today"
          icon={CalendarDays}
          accentColor={markedCount === totalToday && totalToday > 0 ? 'emerald' : 'indigo'}
        />
        <StatCard
          title="Average Attendance"
          value={`${reportSummary?.overallPercentage || 0}%`}
          subtitle="Across your assigned courses"
          icon={TrendingUp}
          accentColor={
            (reportSummary?.overallPercentage || 0) >= (reportSummary?.thresholdPercent || 75)
              ? 'emerald'
              : 'amber'
          }
        />
        <StatCard
          title="Total Classes Held"
          value={reportSummary?.totalClassesConducted || 0}
          subtitle="Historical lectures recorded"
          icon={CheckCircle2}
          accentColor="cyan"
        />
      </div>

      {/* Holiday Banner for Teacher */}
      {isHoliday && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-teal-100 border border-teal-300 text-teal-700 shrink-0">
              <CalendarOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Today is {holidayName}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 uppercase">
                  Official Holiday
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                No lecture attendance is required today. Marking controls are suspended for the day.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Schedule Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              <span>Today&apos;s Class Schedule</span>
            </h3>
            <p className="text-xs text-slate-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {!isHoliday && (
            <Link
              to="/teacher/mark-attendance"
              className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 w-fit"
            >
              <span>Attendance Pad</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {todaySlots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todaySlots.map((slot) => {
              const deptName = slot.section?.department?.code || slot.section?.department?.name || 'Academic Dept';
              return (
                <div
                  key={slot._id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-sm ${
                    slot.isMarked
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-slate-50 border-slate-200/80 hover:border-teal-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* Header with Period & Department Badge */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 px-2 py-0.5 rounded bg-white border border-slate-200 font-mono shadow-sm">
                        Period #{slot.periodNumber}
                      </span>
                      <span className="font-mono text-slate-500 text-[11px] font-semibold">{slot.startTime} - {slot.endTime}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-1">{slot.subject?.name}</h4>

                    {/* Department + Year + Section badge */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-teal-600" />
                        <span>{deptName}</span>
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 flex items-center gap-1 shadow-sm">
                        <Layers className="w-3 h-3 text-teal-600" />
                        <span>{slot.section?.name} · Year {slot.section?.year || 1}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">{slot.studentCount || 0} Students</span>

                    {slot.isMarked ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marked</span>
                      </span>
                    ) : isHoliday ? (
                      <span className="text-slate-400 italic text-[11px]">Holiday</span>
                    ) : (
                      <Link
                        to="/teacher/mark-attendance"
                        className="px-3 py-1 rounded-lg text-xs font-semibold gradient-btn text-white shadow-sm"
                      >
                        Mark Attendance
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            No class periods scheduled for you today.
          </div>
        )}
      </div>
    </div>
  );
};
