const express = require('express');
const router = express.Router();
const hodController = require('../controllers/hodController');
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { uploadCsv } = require('../middleware/upload');

// Enforce HOD auth & roleGuard for all routes in this router
router.use(auth, roleGuard('hod'));

router.get('/departments', hodController.getDepartments);
router.get('/batches', hodController.getBatches);
router.get('/teacher-directory', hodController.getTeacherDirectory);

// Faculty & Staff Management (HOD Scoped CRUD)
router.get('/teachers', hodController.getDepartmentTeachers);
router.post('/teachers', hodController.createStaff);
router.patch('/teachers/:id', hodController.updateStaff);
router.delete('/teachers/:id', hodController.deleteStaff);
router.get('/staff', hodController.getDepartmentTeachers);
router.post('/staff', hodController.createStaff);
router.patch('/staff/:id', hodController.updateStaff);
router.delete('/staff/:id', hodController.deleteStaff);
router.get('/teachers/export-pdf', hodController.exportHodTeachersPdf);

// Subjects (HOD Scoped CRUD) & Sections
router.get('/subjects', hodController.getDepartmentSubjects);
router.post('/subjects', hodController.createSubject);
router.patch('/subjects/:id/archive', hodController.archiveSubject);
router.patch('/subjects/:id/restore', hodController.restoreSubject);
router.patch('/subjects/:id', hodController.updateSubject);
router.delete('/subjects/:id/force', hodController.forceDeleteSubject);
router.delete('/subjects/:id', hodController.deleteSubject);
router.get('/sections', hodController.getDepartmentSections);

// Subject Allocations & CSV/PDF
router.get('/teacher-subjects/export', hodController.exportHodTeacherSubjectsCsv);
router.get('/teacher-subjects/export-pdf', hodController.exportHodTeacherSubjectsPdf);
router.post('/teacher-subjects/import', uploadCsv.single('file'), hodController.importHodTeacherSubjectsCsv);
router.get('/teacher-subjects', hodController.getTeacherSubjectAssignments);
router.post('/teacher-subjects', hodController.createTeacherSubjectAssignment);
router.patch('/teacher-subjects/:id', hodController.updateTeacherSubjectAssignment);
router.delete('/teacher-subjects/:id', hodController.deleteTeacherSubjectAssignment);

// Timetable Schedule PDF & Import & Templates
router.get('/timetable/export-timetable-pdf', hodController.exportHodTimetablePdf);
router.post('/timetable/import', uploadCsv.single('file'), adminController.importPeriodSlotsCsv);
router.delete('/period-templates/:sectionId/:periodNumber', adminController.deletePeriodTemplate);

// Reports & Low Attendance
router.get('/reports/department', hodController.getDepartmentReports);
router.get('/reports/export-pdf', hodController.exportHodReportsPdf);
router.get('/reports/low-attendance', hodController.getLowAttendanceStudents);

// Attendance Audit Trail
router.get('/attendance/export-pdf', hodController.exportHodAttendancePdf);
router.get('/attendance', hodController.getDepartmentAttendanceLogs);

// Defaulters Tracking
router.get('/defaulters/export-pdf', hodController.exportHodDefaultersPdf);
router.get('/defaulters', hodController.getHodDefaulters);

module.exports = router;
