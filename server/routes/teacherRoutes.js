const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Enforce Teacher auth & roleGuard for all routes in this router
router.use(auth, roleGuard('teacher'));

router.get('/timetable/today', teacherController.getTodayTimetable);
router.get('/timetable/weekly', teacherController.getWeeklyTimetable);
router.get('/timetable/export-pdf', teacherController.exportTeacherTimetablePdf);
router.get('/subjects', teacherController.getMySubjects);
router.get('/period/:periodSlotId/students', teacherController.getPeriodRoster);
router.post('/attendance', teacherController.markAttendance);
router.patch('/attendance/:id', teacherController.updateAttendance);
router.get('/reports/my-subjects', teacherController.getMyReports);
router.get('/reports/export-pdf', teacherController.exportTeacherReportsPdf);
router.get('/defaulters/export-pdf', teacherController.exportTeacherDefaultersPdf);
router.get('/defaulters', teacherController.getTeacherDefaulters);

module.exports = router;
