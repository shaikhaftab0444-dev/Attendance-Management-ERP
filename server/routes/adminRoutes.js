const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { uploadCsv } = require('../middleware/upload');

// Enforce auth for all routes in this router
router.use(auth);

// Courses & CSV/PDF (Admin only, Admin & HOD for read)
router.get('/courses/export', roleGuard('admin'), adminController.exportCoursesCsv);
router.get('/courses/export-pdf', roleGuard('admin'), adminController.exportCoursesPdf);
router.post('/courses/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importCoursesCsv);
router.post('/courses', roleGuard('admin'), adminController.createCourse);
router.get('/courses', roleGuard('admin', 'hod'), adminController.getCourses);
router.patch('/courses/:id', roleGuard('admin'), adminController.updateCourse);
router.delete('/courses/:id', roleGuard('admin'), adminController.deleteCourse);

// Departments & CSV/PDF (Admin & HOD for read)
router.get('/departments/export', roleGuard('admin'), adminController.exportDepartmentsCsv);
router.get('/departments/export-pdf', roleGuard('admin'), adminController.exportDepartmentsPdf);
router.post('/departments/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importDepartmentsCsv);
router.post('/departments', roleGuard('admin'), adminController.createDepartment);
router.get('/departments', roleGuard('admin', 'hod'), adminController.getDepartments);
router.patch('/departments/:id', roleGuard('admin'), adminController.updateDepartment);
router.delete('/departments/:id', roleGuard('admin'), adminController.deleteDepartment);

// Batches & CSV/PDF (Admin only, Admin & HOD for read)
router.get('/batches/export', roleGuard('admin'), adminController.exportBatchesCsv);
router.get('/batches/export-pdf', roleGuard('admin'), adminController.exportBatchesPdf);
router.post('/batches/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importBatchesCsv);
router.post('/batches', roleGuard('admin'), adminController.createBatch);
router.get('/batches', roleGuard('admin', 'hod'), adminController.getBatches);
router.patch('/batches/:id', roleGuard('admin'), adminController.updateBatch);
router.delete('/batches/:id', roleGuard('admin'), adminController.deleteBatch);

// Users & CSV/PDF (Admin only)
router.get('/users/export', roleGuard('admin'), adminController.exportUsersCsv);
router.get('/users/export-pdf', roleGuard('admin'), adminController.exportUsersPdf);
router.post('/users/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importUsersCsv);
router.post('/users', roleGuard('admin'), adminController.createUser);
router.get('/teachers-for-course', roleGuard('admin', 'hod'), adminController.getTeachersForCourse);
router.get('/users', roleGuard('admin'), adminController.getUsers);
router.patch('/users/:id', roleGuard('admin'), adminController.updateUser);
router.delete('/users/:id', roleGuard('admin'), adminController.deleteUser);

// Sessions (Admin & HOD for read)
router.post('/sessions', roleGuard('admin'), adminController.createSession);
router.get('/sessions', roleGuard('admin', 'hod'), adminController.getSessions);
router.patch('/sessions/:id', roleGuard('admin'), adminController.updateSession);
router.delete('/sessions/:id', roleGuard('admin'), adminController.deleteSession);

// Sections & CSV/PDF (Admin only)
router.get('/sections/export', roleGuard('admin'), adminController.exportSectionsCsv);
router.get('/sections/export-pdf', roleGuard('admin'), adminController.exportSectionsPdf);
router.post('/sections/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importSectionsCsv);
router.post('/sections', roleGuard('admin'), adminController.createSection);
router.get('/sections', roleGuard('admin'), adminController.getSections);
router.patch('/sections/:id', roleGuard('admin'), adminController.updateSection);
router.delete('/sections/:id', roleGuard('admin'), adminController.deleteSection);

// Subjects & CSV/PDF (Admin & HOD for read)
router.get('/subjects/export', roleGuard('admin'), adminController.exportSubjectsCsv);
router.get('/subjects/export-pdf', roleGuard('admin'), adminController.exportSubjectsPdf);
router.post('/subjects/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importSubjectsCsv);
router.post('/subjects', roleGuard('admin'), adminController.createSubject);
router.get('/subjects', roleGuard('admin', 'hod'), adminController.getSubjects);
router.patch('/subjects/:id/archive', roleGuard('admin'), adminController.archiveSubject);
router.patch('/subjects/:id/restore', roleGuard('admin'), adminController.restoreSubject);
router.patch('/subjects/:id', roleGuard('admin'), adminController.updateSubject);
router.delete('/subjects/:id/force', roleGuard('admin'), adminController.forceDeleteSubject);
router.delete('/subjects/:id', roleGuard('admin'), adminController.deleteSubject);

// Students & CSV/PDF (Admin only)
router.get('/students/duplicates', roleGuard('admin'), adminController.detectDuplicateStudents);
router.post('/students/resolve-duplicates', roleGuard('admin'), adminController.resolveDuplicateStudents);
router.get('/students/export', roleGuard('admin'), adminController.exportStudentsCsv);
router.get('/students/export-pdf', roleGuard('admin'), adminController.exportStudentsPdf);
router.post('/students/bulk-import', roleGuard('admin'), uploadCsv.single('file'), adminController.bulkImportStudents);
router.post('/students', roleGuard('admin'), adminController.createStudent);
router.get('/students', roleGuard('admin'), adminController.getStudents);
router.patch('/students/:id', roleGuard('admin'), adminController.updateStudent);
router.delete('/students/:id', roleGuard('admin'), adminController.deleteStudent);

// Data Cleanup & Year/Batch Backfill (Admin only)
router.post('/backfill-years', roleGuard('admin'), adminController.backfillMissingYears);
router.post('/backfill-section-batches', roleGuard('admin'), adminController.backfillMissingSectionBatches);

// Timetable / Period Slots & CSV/PDF (Admin & HOD)
router.get('/period-slots/export', roleGuard('admin', 'hod'), adminController.exportPeriodSlotsCsv);
router.get('/period-slots/export-timetable-pdf', roleGuard('admin', 'hod'), adminController.exportTimetablePdf);
router.post('/period-slots/import', roleGuard('admin', 'hod'), uploadCsv.single('file'), adminController.importPeriodSlotsCsv);
router.get('/period-slots/inconsistencies', roleGuard('admin', 'hod'), adminController.getPeriodTimingInconsistencies);
router.post('/period-slots/resolve-inconsistency', roleGuard('admin', 'hod'), adminController.resolvePeriodTimingInconsistency);
router.get('/period-templates', roleGuard('admin', 'hod'), adminController.getPeriodTemplates);
router.put('/period-templates', roleGuard('admin', 'hod'), adminController.updatePeriodTemplate);
router.post('/period-slots', roleGuard('admin', 'hod'), adminController.createPeriodSlot);
router.patch('/period-slots/:id', roleGuard('admin', 'hod'), adminController.updatePeriodSlot);
router.get('/period-slots', roleGuard('admin', 'hod'), adminController.getPeriodSlots);
router.delete('/period-slots/:id', roleGuard('admin', 'hod'), adminController.deletePeriodSlot);

// Holidays & CSV/PDF (Admin only)
router.get('/holidays/export', roleGuard('admin'), adminController.exportHolidaysCsv);
router.get('/holidays/export-pdf', roleGuard('admin'), adminController.exportHolidaysPdf);
router.post('/holidays/import', roleGuard('admin'), uploadCsv.single('file'), adminController.importHolidaysCsv);
router.post('/holidays', roleGuard('admin'), adminController.createHoliday);
router.get('/holidays', roleGuard('admin'), adminController.getHolidays);
router.delete('/holidays/:id', roleGuard('admin'), adminController.deleteHoliday);

// Global Reports, Defaulters & Settings (Admin only)
router.get('/reports/global', roleGuard('admin'), adminController.getGlobalReports);
router.get('/reports/export-pdf', roleGuard('admin'), adminController.exportReportsPdf);
router.get('/defaulters', roleGuard('admin'), adminController.getAdminDefaulters);
router.get('/defaulters/export-pdf', roleGuard('admin'), adminController.exportDefaultersPdf);
router.get('/settings', roleGuard('admin'), adminController.getSettings);
router.patch('/settings', roleGuard('admin'), adminController.updateSettings);

module.exports = router;
