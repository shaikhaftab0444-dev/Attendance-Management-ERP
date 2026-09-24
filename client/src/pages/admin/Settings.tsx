import React, { useEffect, useState } from 'react';
import { Save, ShieldAlert, Clock, Building } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../context/ToastContext';

export const AdminSettings: React.FC = () => {
  const [editWindowHours, setEditWindowHours] = useState(24);
  const [attendanceThresholdPercent, setAttendanceThresholdPercent] = useState(75);
  const [institutionName, setInstitutionName] = useState('AttendEdge Institute of Technology');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/admin/settings');
        if (res.data) {
          setEditWindowHours(res.data.editWindowHours || 24);
          setAttendanceThresholdPercent(res.data.attendanceThresholdPercent || 75);
          setInstitutionName(res.data.institutionName || 'AttendEdge Institute of Technology');
        }
      } catch (err: any) {
        showToast(err.customMessage || 'Error loading settings', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.patch('/admin/settings', {
        editWindowHours: Number(editWindowHours),
        attendanceThresholdPercent: Number(attendanceThresholdPercent),
        institutionName,
      });
      showToast('System settings updated successfully', 'success');
    } catch (err: any) {
      showToast(err.customMessage || 'Failed to update settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">System & Policy Settings</h2>
        <p className="text-xs text-slate-500">Configure global attendance rules, edit time limits, and compliance thresholds</p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Institution Name
            </label>
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Official title shown on university reports and portals.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Teacher Edit Window (Hours)
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={editWindowHours}
                  onChange={(e) => setEditWindowHours(Number(e.target.value))}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Number of hours allowed for a teacher to edit past attendance submissions (Default: 24 hrs).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Low-Attendance Warning Threshold (%)
              </label>
              <div className="relative">
                <ShieldAlert className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={attendanceThresholdPercent}
                  onChange={(e) => setAttendanceThresholdPercent(Number(e.target.value))}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Students below this percentage will be automatically flagged on HOD dashboards (Default: 75%).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold gradient-btn flex items-center gap-2 shadow-md shadow-blue-500/20 text-white"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save System Settings</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
