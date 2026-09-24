import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  GraduationCap,
  Layers,
  BookOpen,
  CalendarDays,
  BarChart3,
  Settings,
  UserCheck,
  ClipboardList,
  Calendar,
  LogOut,
  ChevronRight,
  BookMarked,
  UserX,
  CalendarOff,
  X,
  School,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StatusPill } from '../ui/StatusPill';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isMobile = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (!user) return [];

    if (user.role === 'admin') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
        { label: 'Courses', icon: School, path: '/admin/courses' },
        { label: 'Departments', icon: Building2, path: '/admin/departments' },
        { label: 'Batches', icon: Calendar, path: '/admin/batches' },
        { label: 'Staff Directory', icon: Users, path: '/admin/users' },
        { label: 'Students Roster', icon: GraduationCap, path: '/admin/students' },
        { label: 'Sections', icon: Layers, path: '/admin/sections' },
        { label: 'Subjects', icon: BookOpen, path: '/admin/subjects' },
        { label: 'Timetable Builder', icon: CalendarDays, path: '/admin/timetable' },
        { label: 'Academic Holidays', icon: CalendarOff, path: '/admin/holidays' },
        { label: 'Defaulters Tracker', icon: UserX, path: '/admin/defaulters' },
        { label: 'Global Reports', icon: BarChart3, path: '/admin/reports' },
        { label: 'Settings', icon: Settings, path: '/admin/settings' },
      ];
    }

    if (user.role === 'hod') {
      return [
        { label: 'Department Overview', icon: LayoutDashboard, path: '/hod/dashboard' },
        { label: 'Faculty Members', icon: Users, path: '/hod/teachers' },
        { label: 'Subject Allocations', icon: BookMarked, path: '/hod/assignments' },
        { label: 'Timetable Schedule', icon: CalendarDays, path: '/hod/timetable' },
        { label: 'Defaulters Tracking', icon: UserX, path: '/hod/defaulters' },
        { label: 'Analytics & Reports', icon: BarChart3, path: '/hod/reports' },
        { label: 'Attendance Audit', icon: ClipboardList, path: '/hod/attendance' },
      ];
    }

    if (user.role === 'teacher') {
      return [
        { label: 'My Dashboard', icon: LayoutDashboard, path: '/teacher/dashboard' },
        { label: 'Mark Attendance', icon: UserCheck, path: '/teacher/mark-attendance' },
        { label: 'Defaulter List', icon: UserX, path: '/teacher/defaulters' },
        { label: 'My Timetable', icon: Calendar, path: '/teacher/timetable' },
        { label: 'My Subject Reports', icon: BarChart3, path: '/teacher/reports' },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  const getRoleActiveClass = () => {
    if (user?.role === 'hod') return 'bg-purple-600 text-white shadow-sm shadow-purple-500/25 font-semibold';
    if (user?.role === 'teacher') return 'bg-teal-600 text-white shadow-sm shadow-teal-500/25 font-semibold';
    return 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-semibold';
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-btn flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 text-white">
            AE
          </div>
          <div>
            <h1 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-1.5">
              AttendEdge
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                ERP
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">Attendance Management</p>
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                isActive
                  ? getRoleActiveClass()
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
              <span>{item.label}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all opacity-70" />
          </NavLink>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-100">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-sm text-blue-600 shadow-sm shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 truncate">{user?.name}</p>
              <div className="mt-0.5">
                <StatusPill status={user?.role || 'teacher'} size="sm" />
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
        <div
          className={`fixed inset-y-0 left-0 w-72 max-w-[80vw] shadow-2xl transition-transform duration-300 transform ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>
    );
  }

  return <aside className="w-64 shrink-0 hidden md:block">{sidebarContent}</aside>;
};
