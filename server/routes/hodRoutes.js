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
router.get('/teacher-directory', hodController.getTeacherDirectory);

// Faculty
router.get('/teachers', hodController.getDepartmentTeachers);
router.get('/teachers/export-pdf', hodController.exportHodTeachersPdf);

// Subjects & Sections
router.get('/subjects', hodController.getDepartmentSubjects);
router.get('/sections', hodController.getDepartmentSections);

// Subject Allocations & CSV/PDF
router.get('/teacher-subjects/export', hodController.exportHodTeacherSubjectsCsv);
router.get('/teacher-subjects/export-pdf', hodController.exportHodTeacherSubjectsPdf);
router.post('/teacher-subjects/import', uploadCsv.single('file'), hodController.importHodTeacherSubjectsCsv);
router.get('/teacher-subjects', hodController.getTeacherSubjectAssignments);
router.post('/teacher-subjects', hodController.createTeacherSubjectAssignment);

// Timetable Schedule PDF & Import
router.get('/timetable/export-timetable-pdf', hodController.exportHodTimetablePdf);
router.post('/timetable/import', uploadCsv.single('file'), adminController.importPeriodSlotsCsv);

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
