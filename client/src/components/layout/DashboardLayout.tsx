import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'System Administration Overview';
    if (path.includes('/admin/departments')) return 'Departments Management';
    if (path.includes('/admin/users')) return 'Staff & Faculty Directory';
    if (path.includes('/admin/students')) return 'Students Registry & Roster';
    if (path.includes('/admin/sections')) return 'Sections Configuration';
    if (path.includes('/admin/subjects')) return 'Curriculum & Subjects';
    if (path.includes('/admin/timetable')) return 'Master Timetable Slots';
    if (path.includes('/admin/holidays')) return 'Academic Holidays Calendar';
    if (path.includes('/admin/defaulters')) return 'Institution Defaulters Management';
    if (path.includes('/admin/reports')) return 'Global Institution Analytics';
    if (path.includes('/admin/settings')) return 'System ERP Settings';

    if (path.includes('/hod/dashboard')) return 'Department Head Dashboard';
    if (path.includes('/hod/teachers')) return 'Department Faculty Directory';
    if (path.includes('/hod/assignments')) return 'Faculty Subject Allocations';
    if (path.includes('/hod/timetable')) return 'Department Timetable Schedule';
    if (path.includes('/hod/defaulters')) return 'Department Defaulters Tracking';
    if (path.includes('/hod/reports')) return 'Department Attendance Analytics';
    if (path.includes('/hod/attendance')) return 'Department Attendance Audit Logs';

    if (path.includes('/teacher/dashboard')) return 'Instructor Dashboard';
    if (path.includes('/teacher/mark-attendance')) return 'Mark / Edit Attendance';
    if (path.includes('/teacher/defaulters')) return 'Subject Defaulters Registry';
    if (path.includes('/teacher/timetable')) return 'My Weekly Timetable';
    if (path.includes('/teacher/reports')) return 'My Subject Performance Reports';

    return 'AttendEdge ERP';
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <Sidebar isOpen={true} />

      {/* Mobile Sidebar Drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={true}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title={getPageTitle()}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto space-y-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};
