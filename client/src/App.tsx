import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

// Auth
import { Login } from './pages/Login';

// Admin
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminCourses } from './pages/admin/Courses';
import { AdminDepartments } from './pages/admin/Departments';
import { AdminBatches } from './pages/admin/Batches';
import { AdminSessions } from './pages/admin/Sessions';
import { AdminUsers } from './pages/admin/Users';
import { AdminStudents } from './pages/admin/Students';
import { AdminSections } from './pages/admin/Sections';
import { AdminSubjects } from './pages/admin/Subjects';
import { AdminTimetable } from './pages/admin/Timetable';
import { AdminHolidays } from './pages/admin/Holidays';
import { AdminDefaulters } from './pages/admin/Defaulters';
import { AdminReports } from './pages/admin/Reports';
import { AdminSettings } from './pages/admin/Settings';

// HOD
import { HodDashboard } from './pages/hod/Dashboard';
import { HodTeachers } from './pages/hod/Teachers';
import { HodSubjects } from './pages/hod/Subjects';
import { HodAssignments } from './pages/hod/Assignments';
import { HodTimetable } from './pages/hod/Timetable';
import { HodDefaulters } from './pages/hod/Defaulters';
import { HodReports } from './pages/hod/Reports';
import { HodAttendance } from './pages/hod/Attendance';

// Teacher
import { TeacherDashboard } from './pages/teacher/Dashboard';
import { TeacherMarkAttendance } from './pages/teacher/MarkAttendance';
import { TeacherDefaulters } from './pages/teacher/Defaulters';
import { TeacherTimetable } from './pages/teacher/Timetable';
import { TeacherMyReports } from './pages/teacher/MyReports';

export const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="courses" element={<AdminCourses />} />
              <Route path="departments" element={<AdminDepartments />} />
              <Route path="batches" element={<AdminBatches />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="sections" element={<AdminSections />} />
              <Route path="subjects" element={<AdminSubjects />} />
              <Route path="timetable" element={<AdminTimetable />} />
              <Route path="holidays" element={<AdminHolidays />} />
              <Route path="defaulters" element={<AdminDefaulters />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
            </Route>

            {/* HOD Routes */}
            <Route
              path="/hod"
              element={
                <ProtectedRoute allowedRoles={['hod']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<HodDashboard />} />
              <Route path="teachers" element={<HodTeachers />} />
              <Route path="subjects" element={<HodSubjects />} />
              <Route path="assignments" element={<HodAssignments />} />
              <Route path="timetable" element={<HodTimetable />} />
              <Route path="defaulters" element={<HodDefaulters />} />
              <Route path="reports" element={<HodReports />} />
              <Route path="attendance" element={<HodAttendance />} />
              <Route index element={<Navigate to="/hod/dashboard" replace />} />
            </Route>

            {/* Teacher Routes */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<TeacherDashboard />} />
              <Route path="mark-attendance" element={<TeacherMarkAttendance />} />
              <Route path="defaulters" element={<TeacherDefaulters />} />
              <Route path="timetable" element={<TeacherTimetable />} />
              <Route path="reports" element={<TeacherMyReports />} />
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
            </Route>

            {/* Default Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
};
