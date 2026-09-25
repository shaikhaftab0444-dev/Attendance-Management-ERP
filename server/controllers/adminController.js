const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Course = require('../models/Course');
const Department = require('../models/Department');
const User = require('../models/User');
const Student = require('../models/Student');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const AcademicSession = require('../models/AcademicSession');
const PeriodSlot = require('../models/PeriodSlot');
const Attendance = require('../models/Attendance');
const Setting = require('../models/Setting');
const Holiday = require('../models/Holiday');
const TeacherSubject = require('../models/TeacherSubject');
const PeriodTemplate = require('../models/PeriodTemplate');
const Batch = require('../models/Batch');
const { calculateAttendancePercentage, normalizeDate, parseStudentCsv } = require('../utils/helpers');
const { calculateDefaulters } = require('../utils/defaulterAggregation');
const { parseCsv, toCsv } = require('../utils/csv');
const { generatePdf } = require('../utils/pdf');
const { buildGenericTablePdfHtml, buildTimetablePdfHtml } = require('../utils/pdfTemplate');

// Day of week mapping
const DAY_NAME_TO_INT = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const INT_TO_DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Indian phone validation (+91 followed by 10 digits starting with 6-9)
const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

function validateIndianPhone(phone) {
  if (!phone || phone.trim() === '') return true; // optional field
  return INDIAN_PHONE_REGEX.test(phone.trim());
}

function normalizeCsvPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.toString().trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return null; // invalid format
}

// ==================== COURSES ====================
const createCourse = async (req, res) => {
  try {
    const { name, code, durationYears } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'Name and Code are required for Course.' });
    }

    const duration = durationYears ? Number(durationYears) : 4;
    if (isNaN(duration) || duration < 1) {
      return res.status(400).json({ message: 'Duration (in years) must be a positive number.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Course.findOne({ code: cleanCode });
    if (existing) {
      return res.status(409).json({ message: `Course with code '${cleanCode}' already exists.` });
    }

    const course = new Course({
      name: name.trim(),
      code: cleanCode,
      durationYears: duration,
    });

    await course.save();
    return res.status(201).json(course);
  } catch (error) {
    console.error('createCourse error:', error);
    return res.status(500).json({ message: 'Error creating course', error: error.message });
  }
};

const getCourses = async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    const courseIds = courses.map((c) => c._id);
    const deptCounts = await Department.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
    ]);
    const deptCountMap = new Map();
    deptCounts.forEach((dc) => deptCountMap.set(dc._id.toString(), dc.count));

    const coursesWithCount = courses.map((c) => {
      const obj = c.toObject();
      obj.departmentCount = deptCountMap.get(c._id.toString()) || 0;
      return obj;
    });

    return res.status(200).json(coursesWithCount);
  } catch (error) {
    console.error('getCourses error:', error);
    return res.status(500).json({ message: 'Error fetching courses' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, durationYears } = req.body;

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    if (code) {
      const cleanCode = code.toUpperCase().trim();
      const existing = await Course.findOne({ _id: { $ne: id }, code: cleanCode });
      if (existing) {
        return res.status(409).json({ message: `Course with code '${cleanCode}' already exists.` });
      }
      course.code = cleanCode;
    }

    if (name) course.name = name.trim();
    if (durationYears !== undefined) {
      const dur = Number(durationYears);
      if (isNaN(dur) || dur < 1) {
        return res.status(400).json({ message: 'Duration (in years) must be a positive number.' });
      }
      course.durationYears = dur;
    }

    await course.save();
    return res.status(200).json(course);
  } catch (error) {
    console.error('updateCourse error:', error);
    return res.status(500).json({ message: 'Error updating course', error: error.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found.' });
    }

    const deptCount = await Department.countDocuments({ course: id });
    if (deptCount > 0) {
      return res.status(409).json({
        message: `Cannot delete Course '${course.name}' -- it still has ${deptCount} department(s) assigned to it. Reassign or remove these first.`,
      });
    }

    await Course.findByIdAndDelete(id);
    return res.status(200).json({ message: `Course '${course.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteCourse error:', error);
    return res.status(500).json({ message: 'Error deleting course', error: error.message });
  }
};

const exportCoursesCsv = async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    const rows = courses.map((c) => ({
      name: c.name,
      code: c.code,
      durationYears: c.durationYears,
    }));
    const csvData = toCsv(rows, ['name', 'code', 'durationYears']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="courses.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportCoursesCsv error:', err);
    return res.status(500).json({ message: 'Error exporting courses CSV' });
  }
};

const exportCoursesPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const courses = await Course.find().sort({ name: 1 });
    const courseIds = courses.map((c) => c._id);
    const deptCounts = await Department.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
    ]);
    const deptCountMap = new Map();
    deptCounts.forEach((dc) => deptCountMap.set(dc._id.toString(), dc.count));

    const rows = courses.map((c) => ({
      name: c.name,
      code: c.code,
      durationYears: `${c.durationYears} Years`,
      departmentsCount: deptCountMap.get(c._id.toString()) || 0,
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Course Programs Directory',
      subtitle: 'Complete list of active academic degree and diploma programs',
      columns: [
        { header: 'Program Name', key: 'name' },
        { header: 'Program Code', key: 'code', align: 'center' },
        { header: 'Duration', key: 'durationYears', align: 'center' },
        { header: 'Departments', key: 'departmentsCount', align: 'center' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="courses.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportCoursesPdf error:', err);
    return res.status(500).json({ message: 'Error generating courses PDF', error: err.message });
  }
};

const importCoursesCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const code = (row.code || row.Code || '').toUpperCase().trim();
      const durationRaw = row.durationYears || row.DurationYears || row.duration || 4;
      const durationYears = Number(durationRaw) || 4;

      if (!name || !code) {
        errors.push({ row: lineNum, reason: 'Name and Code are required.' });
        skipped++;
        continue;
      }

      let course = await Course.findOne({ code });
      if (course) {
        course.name = name;
        course.durationYears = durationYears;
        await course.save();
        updated++;
      } else {
        course = new Course({
          name,
          code,
          durationYears,
        });
        await course.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importCoursesCsv error:', err);
    return res.status(500).json({ message: 'Error importing courses', error: err.message });
  }
};

// ==================== DEPARTMENTS ====================
const createDepartment = async (req, res) => {
  try {
    const { name, code, course } = req.body;
    if (!name || !code || !course) {
      return res.status(400).json({ message: 'Name, Code, and Course are required.' });
    }

    const courseDoc = mongoose.Types.ObjectId.isValid(course)
      ? await Course.findById(course)
      : await Course.findOne({ code: course.toUpperCase().trim() });

    if (!courseDoc) {
      return res.status(400).json({ message: 'Selected Course not found. Please provide a valid Course.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Department.findOne({ course: courseDoc._id, code: cleanCode });
    if (existing) {
      return res.status(409).json({ message: `Department with code '${cleanCode}' already exists under course '${courseDoc.name}'.` });
    }

    const dept = new Department({
      name: name.trim(),
      code: cleanCode,
      course: courseDoc._id,
    });

    await dept.save();
    const populated = await Department.findById(dept._id).populate('course', 'name code durationYears');
    return res.status(201).json(populated);
  } catch (error) {
    console.error('createDepartment error:', error);
    return res.status(500).json({ message: 'Error creating department', error: error.message });
  }
};

const getDepartments = async (req, res) => {
  try {
    const { course } = req.query;
    const filter = {};
    if (course) {
      if (mongoose.Types.ObjectId.isValid(course)) {
        filter.course = course;
      } else {
        const cDoc = await Course.findOne({ code: course.toUpperCase().trim() });
        if (cDoc) filter.course = cDoc._id;
      }
    }

    const departments = await Department.find(filter).populate('course', 'name code durationYears').sort({ name: 1 });
    return res.status(200).json(departments);
  } catch (error) {
    console.error('getDepartments error:', error);
    return res.status(500).json({ message: 'Error fetching departments' });
  }
};

const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, course } = req.body;

    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    let targetCourseId = dept.course;
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (!courseDoc) {
        return res.status(400).json({ message: 'Valid Course is required.' });
      }
      targetCourseId = courseDoc._id;
      dept.course = courseDoc._id;
    }

    const targetCode = code ? code.toUpperCase().trim() : dept.code;

    if (targetCourseId && (code || course)) {
      const conflict = await Department.findOne({
        _id: { $ne: id },
        course: targetCourseId,
        code: targetCode,
      });
      if (conflict) {
        return res.status(409).json({ message: `Department with code '${targetCode}' already exists under this course.` });
      }
    }

    if (name) dept.name = name.trim();
    if (code) dept.code = targetCode;

    await dept.save();
    const populated = await Department.findById(id).populate('course', 'name code durationYears');
    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateDepartment error:', error);
    return res.status(500).json({ message: 'Error updating department', error: error.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const dept = await Department.findById(id);
    if (!dept) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const [secCount, subjCount, studCount, userCount] = await Promise.all([
      Section.countDocuments({ department: id }),
      Subject.countDocuments({ department: id }),
      Student.countDocuments({ department: id }),
      User.countDocuments({ department: id, role: 'teacher', isActive: true }),
    ]);

    const total = secCount + subjCount + studCount + userCount;
    if (total > 0) {
      const parts = [];
      if (secCount > 0) parts.push(`${secCount} section(s)`);
      if (subjCount > 0) parts.push(`${subjCount} subject(s)`);
      if (studCount > 0) parts.push(`${studCount} student(s)`);
      if (userCount > 0) parts.push(`${userCount} faculty member(s)`);
      return res.status(409).json({
        message: `Cannot delete ${dept.name} -- it still has ${parts.join(', ')}. Reassign or remove these first.`,
      });
    }

    await Department.findByIdAndDelete(id);
    return res.status(200).json({ message: `Department '${dept.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteDepartment error:', error);
    return res.status(500).json({ message: 'Error deleting department', error: error.message });
  }
};

const exportDepartmentsCsv = async (req, res) => {
  try {
    const departments = await Department.find().populate('course', 'code').sort({ name: 1 });
    const rows = departments.map((d) => ({
      name: d.name,
      code: d.code,
      courseCode: d.course?.code || '',
    }));
    const csvData = toCsv(rows, ['name', 'code', 'courseCode']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="departments.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportDepartmentsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting departments CSV' });
  }
};

const exportDepartmentsPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const departments = await Department.find().populate('course', 'name code').sort({ name: 1 });
    const rows = departments.map((d) => ({
      name: d.name,
      code: d.code,
      courseName: d.course ? `${d.course.name} (${d.course.code})` : '—',
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Academic Departments Directory',
      subtitle: 'Official list of departments and associated degree programs',
      columns: [
        { header: 'Department Name', key: 'name' },
        { header: 'Code', key: 'code', align: 'center' },
        { header: 'Parent Program', key: 'courseName' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="departments.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportDepartmentsPdf error:', err);
    return res.status(500).json({ message: 'Error generating departments PDF', error: err.message });
  }
};

// ==================== BATCHES ====================
const createBatch = async (req, res) => {
  try {
    const { name, course, startYear, endYear, isActive, assignedTeachers } = req.body;
    if (!course || !startYear) {
      return res.status(400).json({ message: 'Course and Start Year are required.' });
    }
    const courseDoc = await Course.findById(course);
    if (!courseDoc) {
      return res.status(404).json({ message: 'Course not found.' });
    }
    const sYear = Number(startYear);
    const eYear = endYear ? Number(endYear) : (sYear + (courseDoc.durationYears || 4));
    const batchName = name ? name.trim() : `${sYear}-${eYear}`;

    const existing = await Batch.findOne({ course, name: batchName });
    if (existing) {
      return res.status(409).json({ message: `Batch '${batchName}' already exists for this course.` });
    }

    const teacherIds = Array.isArray(assignedTeachers)
      ? assignedTeachers.filter((t) => mongoose.Types.ObjectId.isValid(t))
      : [];

    const batch = new Batch({
      name: batchName,
      course,
      startYear: sYear,
      endYear: eYear,
      isActive: isActive !== undefined ? isActive : true,
      assignedTeachers: teacherIds,
    });
    await batch.save();

    // Synchronize with Users
    if (teacherIds.length > 0) {
      await User.updateMany(
        { _id: { $in: teacherIds } },
        { $addToSet: { assignedBatches: batch._id, batches: batch._id } }
      );
    }

    const populated = await Batch.findById(batch._id)
      .populate('course', 'name code durationYears')
      .populate('assignedTeachers', 'name email employeeId phone');
    return res.status(201).json(populated);
  } catch (error) {
    console.error('createBatch error:', error);
    return res.status(500).json({ message: 'Error creating batch', error: error.message });
  }
};

const getBatches = async (req, res) => {
  try {
    const { course, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        filter.course = courseDoc._id;
      }
    }

    const batches = await Batch.find(filter)
      .populate('course', 'name code durationYears')
      .populate('assignedTeachers', 'name email employeeId phone')
      .sort({ startYear: -1, name: 1 });

    const batchIds = batches.map((b) => b._id);
    const counts = await Student.aggregate([
      { $match: { batch: { $in: batchIds }, isActive: { $ne: false } } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]);
    const countMap = new Map();
    counts.forEach((c) => countMap.set(c._id.toString(), c.count));

    const result = batches.map((b) => {
      const obj = b.toObject();
      obj.studentCount = countMap.get(b._id.toString()) || 0;
      return obj;
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('getBatches error:', error);
    return res.status(500).json({ message: 'Error fetching batches', error: error.message });
  }
};

const updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, course, startYear, endYear, isActive, assignedTeachers } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    if (course) batch.course = course;
    if (startYear) batch.startYear = Number(startYear);
    if (endYear) batch.endYear = Number(endYear);
    if (name) batch.name = name.trim();
    if (isActive !== undefined) batch.isActive = isActive;

    let newTeacherIds = null;
    if (assignedTeachers !== undefined) {
      newTeacherIds = Array.isArray(assignedTeachers)
        ? assignedTeachers.filter((t) => mongoose.Types.ObjectId.isValid(t))
        : [];
      batch.assignedTeachers = newTeacherIds;
    }

    await batch.save();

    // Sync with User model
    if (newTeacherIds !== null) {
      // Remove this batch from any users no longer assigned
      await User.updateMany(
        { assignedBatches: id, _id: { $nin: newTeacherIds } },
        { $pull: { assignedBatches: id, batches: id } }
      );
      // Add this batch to newly assigned users
      if (newTeacherIds.length > 0) {
        await User.updateMany(
          { _id: { $in: newTeacherIds } },
          { $addToSet: { assignedBatches: id, batches: id } }
        );
      }
    }

    const populated = await Batch.findById(id)
      .populate('course', 'name code durationYears')
      .populate('assignedTeachers', 'name email employeeId phone');
    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateBatch error:', error);
    return res.status(500).json({ message: 'Error updating batch', error: error.message });
  }
};

const deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    const studentCount = await Student.countDocuments({ batch: id });
    if (studentCount > 0) {
      return res.status(400).json({
        message: `Cannot delete batch '${batch.name}' because it has ${studentCount} assigned student(s). Please reassign or delete these students first.`,
      });
    }

    await Batch.findByIdAndDelete(id);
    return res.status(200).json({ message: `Batch '${batch.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteBatch error:', error);
    return res.status(500).json({ message: 'Error deleting batch', error: error.message });
  }
};

const exportBatchesCsv = async (req, res) => {
  try {
    const { course, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) filter.course = courseDoc._id;
    }

    const batches = await Batch.find(filter)
      .populate('course', 'code name')
      .sort({ startYear: -1, name: 1 });

    const rows = batches.map((b) => ({
      name: b.name,
      courseCode: b.course?.code || '',
      startYear: b.startYear,
      endYear: b.endYear,
      isActive: b.isActive ? 'Active' : 'Archived',
    }));

    const csvData = toCsv(rows, ['name', 'courseCode', 'startYear', 'endYear', 'isActive']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="batches.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportBatchesCsv error:', err);
    return res.status(500).json({ message: 'Error exporting batches CSV' });
  }
};

const importBatchesCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const courseCode = (row.courseCode || row.CourseCode || '').toUpperCase().trim();
      const startYear = Number(row.startYear || row.StartYear);
      const endYear = Number(row.endYear || row.EndYear);
      const isActiveRaw = row.isActive || row.IsActive || 'Active';
      const isActive = isActiveRaw.toString().toLowerCase() !== 'archived' && isActiveRaw.toString().toLowerCase() !== 'false';

      if (!courseCode || !startYear) {
        errors.push({ row: lineNum, reason: 'CourseCode and StartYear are required.' });
        skipped++;
        continue;
      }

      const courseDoc = courseMap.get(courseCode);
      if (!courseDoc) {
        errors.push({ row: lineNum, reason: `Course with code '${courseCode}' not found.` });
        skipped++;
        continue;
      }

      const calculatedEndYear = endYear || (startYear + (courseDoc.durationYears || 4));
      const calculatedName = name || `${startYear}-${calculatedEndYear}`;

      let existing = await Batch.findOne({ course: courseDoc._id, name: calculatedName });
      if (existing) {
        existing.startYear = startYear;
        existing.endYear = calculatedEndYear;
        existing.isActive = isActive;
        await existing.save();
        updated++;
      } else {
        await Batch.create({
          name: calculatedName,
          course: courseDoc._id,
          startYear,
          endYear: calculatedEndYear,
          isActive,
        });
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importBatchesCsv error:', err);
    return res.status(500).json({ message: 'Error importing batches CSV', error: err.message });
  }
};

const exportBatchesPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const { course, isActive } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    let courseNameFilter = '';
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        filter.course = courseDoc._id;
        courseNameFilter = `${courseDoc.name} (${courseDoc.code})`;
      }
    }

    const batches = await Batch.find(filter)
      .populate('course', 'name code')
      .sort({ startYear: -1, name: 1 });

    const batchIds = batches.map((b) => b._id);
    const counts = await Student.aggregate([
      { $match: { batch: { $in: batchIds }, isActive: { $ne: false } } },
      { $group: { _id: '$batch', count: { $sum: 1 } } },
    ]);
    const countMap = new Map();
    counts.forEach((c) => countMap.set(c._id.toString(), c.count));

    const rows = batches.map((b) => ({
      name: b.name,
      course: b.course ? `${b.course.name} (${b.course.code})` : '—',
      startYear: b.startYear,
      endYear: b.endYear,
      studentCount: countMap.get(b._id.toString()) || 0,
      status: b.isActive ? 'Active' : 'Archived',
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Student Cohort Batches Master List',
      subtitle: 'Admission-year ranges and cohort progression tracking',
      filters: {
        ...(courseNameFilter ? { Program: courseNameFilter } : {}),
        ...(isActive && isActive !== 'all' ? { Status: isActive === 'true' ? 'Active Only' : 'Archived Only' } : {}),
      },
      columns: [
        { header: 'Batch Name', key: 'name' },
        { header: 'Program', key: 'course' },
        { header: 'Start Year', key: 'startYear', align: 'center' },
        { header: 'End Year', key: 'endYear', align: 'center' },
        { header: 'Students', key: 'studentCount', align: 'center' },
        {
          header: 'Status',
          render: (r) => `<span class="badge ${r.status === 'Active' ? 'badge-green' : 'badge-slate'}">${r.status}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="batches.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportBatchesPdf error:', err);
    return res.status(500).json({ message: 'Error generating batches PDF', error: err.message });
  }
};

const importDepartmentsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const code = (row.code || row.Code || '').toUpperCase().trim();
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();

      if (!name || !code) {
        errors.push({ row: lineNum, reason: 'Name and Code are required.' });
        skipped++;
        continue;
      }

      if (!courseCode) {
        errors.push({ row: lineNum, reason: `courseCode is required for department '${code}'.` });
        skipped++;
        continue;
      }

      const courseDoc = courseMap.get(courseCode);
      if (!courseDoc) {
        errors.push({ row: lineNum, reason: `Course with code '${courseCode}' not found.` });
        skipped++;
        continue;
      }

      let dept = await Department.findOne({ course: courseDoc._id, code });
      if (dept) {
        dept.name = name;
        await dept.save();
        updated++;
      } else {
        dept = new Department({
          name,
          code,
          course: courseDoc._id,
        });
        await dept.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importDepartmentsCsv error:', err);
    return res.status(500).json({ message: 'Error importing departments', error: err.message });
  }
};

// ==================== USERS ====================
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, department, course, year, employeeId, phone, teachingYears } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists.' });
    }

    let assignedYear = null;
    let assignedDept = null;
    let assignedCourse = null;
    let assignedTeachingYears = undefined;

    let assignedBatchesIds = [];
    if (Array.isArray(req.body.assignedBatches)) {
      assignedBatchesIds = req.body.assignedBatches.filter((b) => mongoose.Types.ObjectId.isValid(b));
    } else if (Array.isArray(req.body.batches)) {
      assignedBatchesIds = req.body.batches.filter((b) => mongoose.Types.ObjectId.isValid(b));
    }

    if (role === 'hod') {
      if (assignedBatchesIds.length === 0) {
        return res.status(400).json({ message: 'At least one Managed Batch is required for HOD role.' });
      }
      const firstBatch = await Batch.findById(assignedBatchesIds[0]).populate('course');
      assignedCourse = firstBatch?.course?._id || firstBatch?.course || null;
      assignedDept = null;
      assignedYear = null;
    } else if (role === 'teacher') {
      if (!department) {
        return res.status(400).json({ message: 'Department is required for Teacher role.' });
      }
      assignedDept = department;

      let validYears = [];
      if (Array.isArray(teachingYears)) {
        validYears = teachingYears.map(Number).filter((y) => [1, 2, 3, 4].includes(y));
      }
      if (validYears.length === 0) {
        return res.status(400).json({ message: 'At least one Teaching Year (1-4) is required for Teacher role.' });
      }
      assignedTeachingYears = Array.from(new Set(validYears)).sort((a, b) => a - b);
    }

    if (phone && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      department: assignedDept,
      course: assignedCourse,
      year: assignedYear,
      teachingYears: role === 'teacher' ? assignedTeachingYears : undefined,
      assignedBatches: ['teacher', 'hod'].includes(role) ? assignedBatchesIds : [],
      batches: ['teacher', 'hod'].includes(role) ? assignedBatchesIds : [],
      employeeId: employeeId || '',
      phone: phone ? phone.trim() : '',
      isActive: true,
    });

    await user.save();

    // Synchronize with Batches
    if (role === 'teacher' && assignedBatchesIds.length > 0) {
      await Batch.updateMany(
        { _id: { $in: assignedBatchesIds } },
        { $addToSet: { assignedTeachers: user._id } }
      );
    }

    const populatedUser = await User.findById(user._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('course', 'name code durationYears')
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .populate('batches', 'name startYear endYear course isActive')
      .select('-passwordHash');

    return res.status(201).json(populatedUser);
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const { role, department, year, course, batch } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (batch) filter.assignedBatches = batch;

    let courseDeptIds = [];
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });

      if (courseDoc) {
        const courseDepts = await Department.find({ course: courseDoc._id }).select('_id');
        courseDeptIds = courseDepts.map((d) => d._id);

        if (role === 'teacher') {
          filter.department = { $in: courseDeptIds };
        } else if (role === 'hod') {
          filter.course = courseDoc._id;
        } else {
          filter.$or = [
            { course: courseDoc._id },
            { department: { $in: courseDeptIds } },
          ];
        }
      }
    }

    // Handle year filter
    if (year) {
      const targetYear = Number(year);
      const secYearFilter = { year: targetYear };
      if (department) {
        secYearFilter.department = department;
      } else if (courseDeptIds.length > 0) {
        secYearFilter.department = { $in: courseDeptIds };
      }
      const matchingSections = await Section.find(secYearFilter).select('_id');
      const matchingSecIds = matchingSections.map((s) => s._id);

      const [tsTeacherIds, slotTeacherIds] = await Promise.all([
        TeacherSubject.find({ section: { $in: matchingSecIds } }).distinct('teacher'),
        PeriodSlot.find({ section: { $in: matchingSecIds }, isRecess: { $ne: true } }).distinct('teacher'),
      ]);
      const validYearTeacherIds = Array.from(
        new Set([...tsTeacherIds, ...slotTeacherIds].filter(Boolean).map((id) => id.toString()))
      );

      const teacherOr = [
        { teachingYears: targetYear },
        { _id: { $in: validYearTeacherIds } },
      ];

      if (role === 'teacher') {
        filter.$or = teacherOr;
      } else if (role === 'hod') {
        filter.year = targetYear;
      } else {
        const orConditions = [
          { role: 'teacher', $or: teacherOr },
          { role: 'hod', year: targetYear },
          { role: 'admin' },
        ];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: orConditions }];
          delete filter.$or;
        } else {
          filter.$or = orConditions;
        }
      }
    }

    const users = await User.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('course', 'name code durationYears')
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Compute dynamic currentlyTeachingYears for teachers
    const teacherUsers = users.filter((u) => u.role === 'teacher');
    const teacherIds = teacherUsers.map((u) => u._id);

    const teacherYearMap = new Map();
    if (teacherIds.length > 0) {
      const [tsRecords, slotRecords] = await Promise.all([
        TeacherSubject.find({ teacher: { $in: teacherIds } }).populate('section', 'year'),
        PeriodSlot.find({ teacher: { $in: teacherIds }, isRecess: { $ne: true } }).populate('section', 'year'),
      ]);

      for (const rec of tsRecords) {
        const tId = rec.teacher.toString();
        const secYear = rec.section?.year;
        if (secYear) {
          if (!teacherYearMap.has(tId)) teacherYearMap.set(tId, new Set());
          teacherYearMap.get(tId).add(secYear);
        }
      }

      for (const slot of slotRecords) {
        const tId = slot.teacher?.toString();
        const secYear = slot.section?.year;
        if (tId && secYear) {
          if (!teacherYearMap.has(tId)) teacherYearMap.set(tId, new Set());
          teacherYearMap.get(tId).add(secYear);
        }
      }
    }

    const result = users.map((u) => {
      const obj = u.toObject();
      if (u.role === 'teacher') {
        const liveYearsSet = teacherYearMap.get(u._id.toString()) || new Set();
        obj.currentlyTeachingYears = Array.from(liveYearsSet).sort((a, b) => a - b);
        obj.teachingYears = Array.isArray(u.teachingYears) ? u.teachingYears : [];
      } else if (u.role === 'hod') {
        obj.teachingYears = u.year ? [u.year] : [];
        obj.currentlyTeachingYears = u.year ? [u.year] : [];
      } else {
        obj.teachingYears = [];
        obj.currentlyTeachingYears = [];
      }
      return obj;
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('getUsers error:', error);
    return res.status(500).json({ message: 'Error fetching users' });
  }
};

const getTeachersForCourse = async (req, res) => {
  try {
    const { course, department, year, all, allCourse } = req.query;

    if (all === 'true') {
      const teachers = await User.find({ role: 'teacher', isActive: true })
        .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
        .select('name email employeeId phone department teachingYears')
        .sort({ name: 1 });
      return res.status(200).json(teachers);
    }

    let courseDeptIds = [];
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toString().toUpperCase().trim() });

      if (courseDoc) {
        const courseDepts = await Department.find({ course: courseDoc._id }).select('_id');
        courseDeptIds = courseDepts.map((d) => d._id);
      }
    }

    // If allCourse is true, return all teachers in this course across any department/year
    if (allCourse === 'true' && courseDeptIds.length > 0) {
      const allCourseSections = await Section.find({ department: { $in: courseDeptIds } }).select('_id');
      const allCourseSecIds = allCourseSections.map((s) => s._id);

      const assignedTeacherIds = await TeacherSubject.find({ section: { $in: allCourseSecIds } }).distinct('teacher');
      const slotTeacherIds = await PeriodSlot.find({ section: { $in: allCourseSecIds }, isRecess: { $ne: true } }).distinct('teacher');
      const relevantTeacherIds = Array.from(new Set([...assignedTeacherIds, ...slotTeacherIds].filter(Boolean).map((id) => id.toString())));

      const teachers = await User.find({
        role: 'teacher',
        isActive: true,
        $or: [
          { department: { $in: courseDeptIds } },
          { _id: { $in: relevantTeacherIds } },
        ],
      })
        .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
        .select('name email employeeId phone department teachingYears')
        .sort({ name: 1 });

      return res.status(200).json(teachers);
    }

    // Target specific department and/or year
    let targetDeptIds = [];
    if (department) {
      targetDeptIds = [new mongoose.Types.ObjectId(department)];
    } else if (courseDeptIds.length > 0) {
      targetDeptIds = courseDeptIds;
    }

    const secFilter = {};
    if (targetDeptIds.length > 0) {
      secFilter.department = { $in: targetDeptIds };
    }
    if (year) {
      secFilter.year = Number(year);
    }

    const sections = await Section.find(secFilter).select('_id');
    const sectionIds = sections.map((s) => s._id);

    const assignedTeacherIds = await TeacherSubject.find({ section: { $in: sectionIds } }).distinct('teacher');
    const slotTeacherIds = await PeriodSlot.find({ section: { $in: sectionIds }, isRecess: { $ne: true } }).distinct('teacher');
    const relevantTeacherIds = Array.from(new Set([...assignedTeacherIds, ...slotTeacherIds].filter(Boolean).map((id) => id.toString())));

    const orConditions = [];
    if (targetDeptIds.length > 0) {
      if (year) {
        orConditions.push({ department: { $in: targetDeptIds }, teachingYears: Number(year) });
      } else {
        orConditions.push({ department: { $in: targetDeptIds } });
      }
    } else if (year) {
      orConditions.push({ teachingYears: Number(year) });
    }
    if (relevantTeacherIds.length > 0) {
      orConditions.push({ _id: { $in: relevantTeacherIds } });
    }

    const teacherQuery = {
      role: 'teacher',
      isActive: true,
    };

    if (orConditions.length > 0) {
      teacherQuery.$or = orConditions;
    }

    const teachers = await User.find(teacherQuery)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .select('name email employeeId phone department teachingYears assignedBatches')
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error('getTeachersForCourse error:', error);
    return res.status(500).json({ message: 'Error fetching teachers for course', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, department, course, year, employeeId, phone, isActive, teachingYears, assignedBatches } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetRole = role || user.role;

    if (targetRole === 'hod') {
      let validBatchIds = user.assignedBatches || user.batches || [];
      if (assignedBatches !== undefined || req.body.batches !== undefined) {
        const inputBatches = assignedBatches !== undefined ? assignedBatches : req.body.batches;
        validBatchIds = Array.isArray(inputBatches)
          ? inputBatches.filter((b) => mongoose.Types.ObjectId.isValid(b))
          : [];
      }
      if (validBatchIds.length === 0) {
        return res.status(400).json({ message: 'At least one Managed Batch is required for HOD role.' });
      }

      const firstBatch = await Batch.findById(validBatchIds[0]).populate('course');
      user.course = firstBatch?.course?._id || firstBatch?.course || null;
      user.year = null;
      user.department = null;
      user.teachingYears = undefined;
      user.assignedBatches = validBatchIds;
      user.batches = validBatchIds;
    } else if (targetRole === 'teacher') {
      if (department) user.department = department;
      user.course = null;
      user.year = null;

      if (teachingYears !== undefined) {
        let validYears = [];
        if (Array.isArray(teachingYears)) {
          validYears = teachingYears.map(Number).filter((y) => [1, 2, 3, 4].includes(y));
        }
        if (validYears.length === 0) {
          return res.status(400).json({ message: 'At least one Teaching Year (1-4) is required for Teacher role.' });
        }
        user.teachingYears = Array.from(new Set(validYears)).sort((a, b) => a - b);
      }

      if (assignedBatches !== undefined || req.body.batches !== undefined) {
        const inputBatches = assignedBatches !== undefined ? assignedBatches : req.body.batches;
        const validBatchIds = Array.isArray(inputBatches)
          ? inputBatches.filter((b) => mongoose.Types.ObjectId.isValid(b))
          : [];
        user.assignedBatches = validBatchIds;
        user.batches = validBatchIds;

        // Synchronize with Batches
        await Batch.updateMany(
          { assignedTeachers: id, _id: { $nin: validBatchIds } },
          { $pull: { assignedTeachers: id } }
        );
        if (validBatchIds.length > 0) {
          await Batch.updateMany(
            { _id: { $in: validBatchIds } },
            { $addToSet: { assignedTeachers: id } }
          );
        }
      }
    } else {
      user.department = null;
      user.course = null;
      user.year = null;
      user.teachingYears = undefined;
      user.assignedBatches = [];
      user.batches = [];
    }

    if (phone !== undefined && phone !== '' && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role) user.role = role;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (phone !== undefined) user.phone = phone ? phone.trim() : '';
    if (isActive !== undefined) user.isActive = isActive;

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
    }

    await user.save();

    const updatedUser = await User.findById(id)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course')
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .populate('batches', 'name startYear endYear course isActive')
      .select('-passwordHash');

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('updateUser error:', error);
    return res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account.' });
    }

    const [tsCount, slotCount, attCount] = await Promise.all([
      TeacherSubject.countDocuments({ teacher: id }),
      PeriodSlot.countDocuments({ teacher: id }),
      Attendance.countDocuments({ teacher: id }),
    ]);

    const isAssignedHod = user.role === 'hod' && user.year;
    const hasHistory = (tsCount + slotCount + attCount > 0) || isAssignedHod;

    if (hasHistory) {
      user.isActive = false;
      let hodNote = '';
      if (user.role === 'hod' && user.year) {
        hodNote = ` This will leave Year ${user.year} without an assigned HOD.`;
        user.year = null;
        user.course = null;
      }
      await user.save();
      return res.status(200).json({
        message: `User '${user.name}' has associated teaching allocations or history and has been deactivated.${hodNote} They will no longer have system access or appear in active rosters.`,
        softDeleted: true,
      });
    }

    await User.findByIdAndDelete(id);
    return res.status(200).json({
      message: `User '${user.name}' deleted permanently.`,
      softDeleted: false,
    });
  } catch (error) {
    console.error('deleteUser error:', error);
    return res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

const exportUsersCsv = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['teacher', 'hod', 'admin'] } })
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course')
      .sort({ name: 1 });

    const rows = users.map((u) => {
      const courseCode = u.role === 'hod' ? (u.course?.code || '') : (u.department?.course?.code || '');
      const departmentCode = u.role === 'teacher' ? (u.department?.code || '') : '';
      const year = u.role === 'hod' ? (u.year || '') : '';
      const teachingYears = u.role === 'teacher' && u.teachingYears && u.teachingYears.length > 0 ? u.teachingYears.join(',') : '';
      return {
        name: u.name,
        email: u.email,
        role: u.role,
        employeeId: u.employeeId || '',
        phone: u.phone || '',
        courseCode,
        departmentCode,
        year,
        teachingYears,
      };
    });

    const csvData = toCsv(rows, ['name', 'email', 'role', 'employeeId', 'phone', 'courseCode', 'departmentCode', 'year', 'teachingYears']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="staff_directory.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportUsersCsv error:', err);
    return res.status(500).json({ message: 'Error exporting staff CSV' });
  }
};

const exportUsersPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const users = await User.find({ role: { $in: ['teacher', 'hod', 'admin'] } })
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('course')
      .sort({ name: 1 });

    const rows = users.map((u) => {
      let scopeStr = '—';
      if (u.role === 'admin') {
        scopeStr = 'System-wide';
      } else if (u.role === 'hod') {
        scopeStr = `${u.course?.code || 'Course'} · Year ${u.year || '—'}`;
      } else if (u.role === 'teacher') {
        const deptStr = u.department ? `${u.department.name} (${u.department.course?.code || ''})` : '—';
        const yearsStr = u.teachingYears && u.teachingYears.length > 0 ? ` [Y${u.teachingYears.join(',')}]` : '';
        scopeStr = `${deptStr}${yearsStr}`;
      }

      return {
        name: u.name,
        email: u.email,
        role: u.role.toUpperCase(),
        employeeId: u.employeeId || '—',
        phone: u.phone || '—',
        scope: scopeStr,
        status: u.isActive ? 'Active' : 'Inactive',
      };
    });

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Faculty & Staff Directory',
      subtitle: 'Complete list of institutional administrators, HODs, and teaching faculty',
      columns: [
        { header: 'Staff Name', key: 'name' },
        { header: 'Email Address', key: 'email' },
        {
          header: 'Role',
          render: (r) => {
            const cls = r.role === 'ADMIN' ? 'badge-rose' : r.role === 'HOD' ? 'badge-purple' : 'badge-blue';
            return `<span class="badge ${cls}">${r.role}</span>`;
          },
          align: 'center',
        },
        { header: 'Employee ID', key: 'employeeId', align: 'center' },
        { header: 'Phone', key: 'phone', align: 'center' },
        { header: 'Assigned Scope', key: 'scope' },
        {
          header: 'Status',
          render: (r) => `<span class="badge ${r.status === 'Active' ? 'badge-green' : 'badge-slate'}">${r.status}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="staff_directory.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportUsersPdf error:', err);
    return res.status(500).json({ message: 'Error generating staff PDF', error: err.message });
  }
};

const importUsersCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    const passwords = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    const departments = await Department.find().populate('course');
    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d);
      // Fallback single code map if unambiguous
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d);
      }
    });

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const email = (row.email || row.Email || '').toLowerCase().trim();
      const role = (row.role || row.Role || 'teacher').toLowerCase().trim();
      const employeeId = (row.employeeId || row.EmployeeId || row.employee_id || '').trim();
      const phone = (row.phone || row.Phone || '').trim();
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.department || row.DepartmentCode || '').toUpperCase().trim();
      const yearRaw = (row.year || row.Year || '').toString().trim();
      const rawTeachingYears = (row.teachingYears || row.TeachingYears || row.teaching_years || '').toString().trim();
      let rawPassword = (row.password || row.Password || '').trim();

      if (!name || !email) {
        errors.push({ row: lineNum, reason: 'Name and Email are required.' });
        skipped++;
        continue;
      }

      if (!['teacher', 'hod', 'admin'].includes(role)) {
        errors.push({ row: lineNum, reason: `Invalid role: ${role}. Must be teacher, hod, or admin.` });
        skipped++;
        continue;
      }

      let assignedYear = null;
      let assignedCourseDoc = null;
      let deptDoc = null;
      let assignedTeachingYears = undefined;

      if (role === 'hod') {
        if (!courseCode) {
          errors.push({ row: lineNum, reason: `courseCode is required for HOD row '${email}'.` });
          skipped++;
          continue;
        }
        assignedCourseDoc = courseMap.get(courseCode);
        if (!assignedCourseDoc) {
          errors.push({ row: lineNum, reason: `Course code '${courseCode}' not found for HOD row.` });
          skipped++;
          continue;
        }

        const parsedYear = Number(yearRaw);
        if (!parsedYear || parsedYear < 1) {
          errors.push({ row: lineNum, reason: `Valid Year is required for HOD row '${email}'.` });
          skipped++;
          continue;
        }

        const existingHod = await User.findOne({
          role: 'hod',
          course: assignedCourseDoc._id,
          year: parsedYear,
          email: { $ne: email },
          isActive: true,
        });

        if (existingHod) {
          errors.push({
            row: lineNum,
            reason: `${assignedCourseDoc.name} Year ${parsedYear} is already assigned to HOD '${existingHod.name}' (${existingHod.email}).`,
          });
          skipped++;
          continue;
        }
        assignedYear = parsedYear;
      } else if (role === 'teacher') {
        if (!deptCode) {
          errors.push({ row: lineNum, reason: `Department code is required for Teacher row '${email}'.` });
          skipped++;
          continue;
        }

        if (courseCode) {
          deptDoc = deptCompoundMap.get(`${courseCode}_${deptCode}`);
        } else {
          deptDoc = deptCompoundMap.get(deptCode);
        }

        if (!deptDoc) {
          errors.push({
            row: lineNum,
            reason: courseCode
              ? `No department '${deptCode}' found under course '${courseCode}' -- check spelling or create it first.`
              : `Department code '${deptCode}' not found.`,
          });
          skipped++;
          continue;
        }

        if (!rawTeachingYears) {
          errors.push({
            row: lineNum,
            reason: `Teaching year(s) ('teachingYears', e.g. '1,2') is required for Teacher row '${email}'.`,
          });
          skipped++;
          continue;
        }

        const parsedYears = rawTeachingYears
          .split(/[,;\s]+/)
          .map((s) => Number(s.trim()))
          .filter((n) => !isNaN(n) && n >= 1 && n <= 4);
        const uniqueYears = Array.from(new Set(parsedYears)).sort((a, b) => a - b);

        if (uniqueYears.length === 0) {
          errors.push({
            row: lineNum,
            reason: `Invalid teachingYears '${rawTeachingYears}' for Teacher row '${email}'. Must contain valid numbers 1-4 (e.g. '1,2').`,
          });
          skipped++;
          continue;
        }
        assignedTeachingYears = uniqueYears;
      }

      let cleanPhone = '';
      if (phone) {
        const norm = normalizeCsvPhone(phone);
        if (norm === null) {
          errors.push({
            row: lineNum,
            reason: `Invalid Indian phone number '${phone}'. Must be a 10-digit number starting with 6-9.`,
          });
          skipped++;
          continue;
        }
        cleanPhone = norm;
      }

      let user = await User.findOne({ email });
      if (user) {
        user.name = name;
        user.role = role;
        user.employeeId = employeeId || user.employeeId;
        user.phone = cleanPhone || user.phone;
        user.course = assignedCourseDoc ? assignedCourseDoc._id : null;
        user.year = assignedYear;
        user.department = deptDoc ? deptDoc._id : null;
        user.teachingYears = role === 'teacher' ? assignedTeachingYears : undefined;

        if (rawPassword) {
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(rawPassword, salt);
        }

        await user.save();
        updated++;
      } else {
        let tempPassword = rawPassword;
        if (!tempPassword) {
          tempPassword = crypto.randomBytes(4).toString('hex') + 'A1!';
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        user = new User({
          name,
          email,
          passwordHash,
          role,
          course: assignedCourseDoc ? assignedCourseDoc._id : null,
          department: deptDoc ? deptDoc._id : null,
          year: assignedYear,
          teachingYears: role === 'teacher' ? assignedTeachingYears : undefined,
          employeeId,
          phone: cleanPhone,
          isActive: true,
        });

        await user.save();

        passwords.push({
          row: lineNum,
          name,
          email,
          temporaryPassword: tempPassword,
        });
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
      passwords,
    });
  } catch (err) {
    console.error('importUsersCsv error:', err);
    return res.status(500).json({ message: 'Error importing staff directory', error: err.message });
  }
};

// ==================== SESSIONS ====================
const createSession = async (req, res) => {
  try {
    const { year, semesterLabel, startDate, endDate, isActive } = req.body;
    if (!year || !semesterLabel || !startDate || !endDate) {
      return res.status(400).json({ message: 'Year, semesterLabel, startDate, and endDate are required.' });
    }

    if (isActive) {
      await AcademicSession.updateMany({}, { isActive: false });
    }

    const session = new AcademicSession({
      year: year.trim(),
      semesterLabel: semesterLabel.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive !== undefined ? isActive : true,
    });

    await session.save();
    return res.status(201).json(session);
  } catch (error) {
    console.error('createSession error:', error);
    return res.status(500).json({ message: 'Error creating academic session', error: error.message });
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find().sort({ createdAt: -1 });
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('getSessions error:', error);
    return res.status(500).json({ message: 'Error fetching sessions', error: error.message });
  }
};

const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { year, semesterLabel, startDate, endDate, isActive } = req.body;

    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Academic session not found' });
    }

    if (isActive) {
      await AcademicSession.updateMany({ _id: { $ne: id } }, { isActive: false });
      session.isActive = true;
    } else if (isActive === false) {
      session.isActive = false;
    }

    if (year) session.year = year.trim();
    if (semesterLabel) session.semesterLabel = semesterLabel.trim();
    if (startDate) session.startDate = new Date(startDate);
    if (endDate) session.endDate = new Date(endDate);

    await session.save();
    return res.status(200).json(session);
  } catch (error) {
    console.error('updateSession error:', error);
    return res.status(500).json({ message: 'Error updating academic session', error: error.message });
  }
};

const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const session = await AcademicSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Academic session not found' });
    }

    const [secCount, tsCount] = await Promise.all([
      Section.countDocuments({ session: id }),
      TeacherSubject.countDocuments({ session: id }),
    ]);

    if (secCount > 0 || tsCount > 0) {
      return res.status(409).json({
        message: `Cannot delete Academic Session '${session.year} - ${session.semesterLabel}' because ${secCount} class section(s) and ${tsCount} faculty allocation(s) are linked to it.`,
      });
    }

    await AcademicSession.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Academic session deleted successfully' });
  } catch (error) {
    console.error('deleteSession error:', error);
    return res.status(500).json({ message: 'Error deleting academic session', error: error.message });
  }
};

// ==================== SECTIONS ====================
const createSection = async (req, res) => {
  try {
    const { name, department, semester, year, session, batch } = req.body;
    if (!name || !department || !semester || !session) {
      return res.status(400).json({ message: 'Name, department, semester, and session are required.' });
    }

    const semNum = Number(semester);
    const calculatedYear = year ? Number(year) : Math.min(4, Math.max(1, Math.ceil(semNum / 2)));

    const newSection = new Section({
      name: name.trim(),
      department,
      semester: semNum,
      year: calculatedYear,
      session,
      batch: batch || null,
    });
    await newSection.save();

    const populated = await Section.findById(newSection._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('session', 'year semesterLabel')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createSection error:', error);
    return res.status(500).json({ message: 'Error creating section' });
  }
};

const getSections = async (req, res) => {
  try {
    const { department, session, year, course, batch } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (session) filter.session = session;
    if (batch) filter.batch = batch;
    if (year) {
      if (year === 'missing') {
        filter.$or = [{ year: { $exists: false } }, { year: null }];
      } else {
        filter.year = Number(year);
      }
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        const deptIds = depts.map((d) => d._id);
        if (!filter.department) {
          filter.department = { $in: deptIds };
        }
      }
    }

    const sections = await Section.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('session', 'year semesterLabel isActive')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ year: 1, semester: 1, name: 1 });

    return res.status(200).json(sections);
  } catch (error) {
    console.error('getSections error:', error);
    return res.status(500).json({ message: 'Error fetching sections' });
  }
};

const updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, semester, year, session, batch } = req.body;

    const sec = await Section.findById(id);
    if (!sec) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (name) sec.name = name.trim();
    if (department) sec.department = department;
    if (semester) sec.semester = Number(semester);
    if (year) sec.year = Number(year);
    if (session) sec.session = session;
    if (batch !== undefined) sec.batch = batch || null;

    await sec.save();

    if (year) {
      await Student.updateMany({ section: sec._id }, { year: Number(year) });
    }

    const populated = await Section.findById(id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('session', 'year semesterLabel')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateSection error:', error);
    return res.status(500).json({ message: 'Error updating section', error: error.message });
  }
};

const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    const [studCount, slotCount, attCount] = await Promise.all([
      Student.countDocuments({ section: id }),
      PeriodSlot.countDocuments({ section: id }),
      Attendance.countDocuments({ section: id }),
    ]);

    const total = studCount + slotCount + attCount;
    if (total > 0) {
      const parts = [];
      if (studCount > 0) parts.push(`${studCount} student(s)`);
      if (slotCount > 0) parts.push(`${slotCount} timetable slot(s)`);
      if (attCount > 0) parts.push(`${attCount} attendance record(s)`);
      return res.status(409).json({
        message: `Cannot delete Section '${section.name}' -- it still has ${parts.join(', ')} associated with it. Reassign or remove these first.`,
      });
    }

    await Section.findByIdAndDelete(id);
    return res.status(200).json({ message: `Section '${section.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteSection error:', error);
    return res.status(500).json({ message: 'Error deleting section', error: error.message });
  }
};

const backfillMissingSectionBatches = async (req, res) => {
  try {
    const sectionsWithoutBatch = await Section.find({
      $or: [{ batch: { $exists: false } }, { batch: null }],
    }).populate({ path: 'department', populate: { path: 'course' } });

    if (sectionsWithoutBatch.length === 0) {
      return res.status(200).json({ message: 'All sections already have an assigned batch.', updatedCount: 0 });
    }

    const batches = await Batch.find().populate('course');
    let updatedCount = 0;

    for (const sec of sectionsWithoutBatch) {
      const courseId = sec.department?.course?._id?.toString() || sec.department?.course?.toString();
      if (!courseId) continue;

      // Find matching batch for this course based on section year or active status
      const courseBatches = batches.filter((b) => (b.course?._id?.toString() || b.course?.toString()) === courseId);
      if (courseBatches.length > 0) {
        // Find best match by year or active
        const currentYear = new Date().getFullYear();
        const expectedStartYear = currentYear - (sec.year || 1) + 1;
        const matchByYear = courseBatches.find((b) => b.startYear === expectedStartYear);
        const matchActive = courseBatches.find((b) => b.isActive) || courseBatches[0];

        sec.batch = (matchByYear || matchActive)._id;
        await sec.save();
        updatedCount++;
      }
    }

    return res.status(200).json({
      message: `Successfully backfilled batches for ${updatedCount} section(s).`,
      updatedCount,
    });
  } catch (error) {
    console.error('backfillMissingSectionBatches error:', error);
    return res.status(500).json({ message: 'Error backfilling section batches', error: error.message });
  }
};

const exportSectionsCsv = async (req, res) => {
  try {
    const { course, department, year, batch } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (year) filter.year = Number(year);
    if (batch) filter.batch = batch;
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    const sections = await Section.find(filter)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('session', 'semesterLabel year')
      .populate('batch', 'name')
      .sort({ year: 1, name: 1 });

    const rows = sections.map((s) => ({
      courseCode: s.department?.course?.code || '',
      departmentCode: s.department?.code || '',
      name: s.name,
      year: s.year || 1,
      semester: s.semester,
      sessionLabel: s.session?.semesterLabel || '',
      batchName: s.batch?.name || '',
    }));

    const csvData = toCsv(rows, ['courseCode', 'departmentCode', 'name', 'year', 'semester', 'sessionLabel', 'batchName']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sections.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportSectionsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting sections CSV' });
  }
};

const exportSectionsPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const { course, department, year, batch } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (year) filter.year = Number(year);
    if (batch) filter.batch = batch;
    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    const sections = await Section.find(filter)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('session', 'semesterLabel year')
      .populate('batch', 'name')
      .sort({ year: 1, name: 1 });

    const rows = sections.map((s) => ({
      name: s.name,
      course: s.department?.course?.code || '—',
      department: s.department?.name || '—',
      year: `Year ${s.year || 1}`,
      semester: `Sem ${s.semester}`,
      batch: s.batch?.name ? `${s.batch.name} Batch` : '—',
      session: s.session ? `${s.session.year} (${s.session.semesterLabel})` : '—',
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Class Sections Directory',
      subtitle: 'Classroom cohorts, departments, admission batches, and academic session groupings',
      columns: [
        { header: 'Section Name', key: 'name' },
        { header: 'Program', key: 'course', align: 'center' },
        { header: 'Department', key: 'department' },
        { header: 'Academic Year', key: 'year', align: 'center' },
        { header: 'Semester', key: 'semester', align: 'center' },
        {
          header: 'Batch Cohort',
          render: (r) => `<span class="badge badge-indigo font-bold">${r.batch}</span>`,
          align: 'center',
        },
        { header: 'Academic Session', key: 'session' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="sections.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportSectionsPdf error:', err);
    return res.status(500).json({ message: 'Error generating sections PDF', error: err.message });
  }
};

const importSectionsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    const departments = await Department.find().populate('course');
    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d._id);
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d._id);
      }
    });

    const sessions = await AcademicSession.find();
    const activeSession = sessions.find((s) => s.isActive) || sessions[0];
    const sessionMap = new Map();
    sessions.forEach((s) => sessionMap.set(s.semesterLabel.toLowerCase(), s._id));

    const batches = await Batch.find().populate('course');
    const batchCompoundMap = new Map();
    batches.forEach((b) => {
      const cCode = b.course?.code ? b.course.code.toUpperCase() : '';
      batchCompoundMap.set(`${cCode}_${b.name.toUpperCase()}`, b._id);
      if (!batchCompoundMap.has(b.name.toUpperCase())) {
        batchCompoundMap.set(b.name.toUpperCase(), b._id);
      }
    });

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.department || row.DepartmentCode || '').toUpperCase().trim();
      const sem = Number(row.semester || row.Semester || 1);
      const yr = Number(row.year || row.Year || Math.ceil(sem / 2) || 1);
      const sessionLabel = (row.sessionLabel || row.session || '').toLowerCase().trim();
      const batchName = (row.batchName || row.batch || '').trim().toUpperCase();

      if (!name || !deptCode) {
        errors.push({ row: lineNum, reason: 'Name and DepartmentCode are required.' });
        skipped++;
        continue;
      }

      let deptId = null;
      if (courseCode) {
        deptId = deptCompoundMap.get(`${courseCode}_${deptCode}`);
      } else {
        deptId = deptCompoundMap.get(deptCode);
      }

      if (!deptId) {
        errors.push({
          row: lineNum,
          reason: courseCode
            ? `No department '${deptCode}' found under course '${courseCode}' -- check spelling or create it first.`
            : `Department code '${deptCode}' not found.`,
        });
        skipped++;
        continue;
      }

      const sessionId = sessionMap.get(sessionLabel) || (activeSession ? activeSession._id : null);
      if (!sessionId) {
        errors.push({ row: lineNum, reason: 'No active academic session found.' });
        skipped++;
        continue;
      }

      let batchId = null;
      if (batchName) {
        if (courseCode) {
          batchId = batchCompoundMap.get(`${courseCode}_${batchName}`);
        } else {
          batchId = batchCompoundMap.get(batchName);
        }
      }

      // Fallback batch for department's course if omitted
      if (!batchId) {
        const targetDept = departments.find((d) => d._id.toString() === deptId.toString());
        const targetCourseId = targetDept?.course?._id?.toString() || targetDept?.course?.toString();
        const courseBatches = batches.filter((b) => (b.course?._id?.toString() || b.course?.toString()) === targetCourseId);
        if (courseBatches.length > 0) {
          batchId = (courseBatches.find((b) => b.isActive) || courseBatches[0])._id;
        }
      }

      let sec = await Section.findOne({ name, department: deptId, session: sessionId });
      if (sec) {
        sec.semester = sem;
        sec.year = yr;
        if (batchId) sec.batch = batchId;
        await sec.save();
        updated++;
      } else {
        sec = new Section({
          name,
          department: deptId,
          semester: sem,
          year: yr,
          session: sessionId,
          batch: batchId || null,
        });
        await sec.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importSectionsCsv error:', err);
    return res.status(500).json({ message: 'Error importing sections', error: err.message });
  }
};

// ==================== SUBJECTS ====================
const createSubject = async (req, res) => {
  try {
    const { name, code, department, semester, year, credits, teacher, batch } = req.body;
    if (!name || !code || !department || !semester) {
      return res.status(400).json({ message: 'Name, code, department, and semester are required.' });
    }

    const sem = Number(semester);
    const yr = year ? Number(year) : Math.min(4, Math.max(1, Math.ceil(sem / 2)));
    if (!yr || yr < 1) {
      return res.status(400).json({ message: 'A valid Academic Year is required.' });
    }

    const subject = new Subject({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      department,
      semester: sem,
      year: yr,
      credits: credits ? Number(credits) : 3,
      batch: batch && mongoose.Types.ObjectId.isValid(batch) ? batch : null,
    });
    await subject.save();

    let assignedSectionsCount = 0;
    let assignedTeacherDoc = null;

    if (teacher) {
      // Validate teacher has role 'teacher'
      const teacherDoc = await User.findOne({ _id: teacher, role: 'teacher', isActive: true });
      if (teacherDoc) {
        assignedTeacherDoc = teacherDoc;
        const activeSession = await AcademicSession.findOne({ isActive: true });
        const matchingSections = await Section.find({
          department,
          year: yr,
          semester: sem,
        });

        if (activeSession && matchingSections.length > 0) {
          for (const sec of matchingSections) {
            await TeacherSubject.findOneAndUpdate(
              {
                teacher: teacherDoc._id,
                subject: subject._id,
                section: sec._id,
                session: activeSession._id,
              },
              {
                teacher: teacherDoc._id,
                subject: subject._id,
                section: sec._id,
                session: activeSession._id,
              },
              { upsert: true, new: true }
            );
          }
          assignedSectionsCount = matchingSections.length;
        }
      }
    }

    const populated = await Subject.findById(subject._id)
      .populate({
        path: 'department',
        populate: { path: 'course', select: 'name code durationYears' },
      })
      .populate('batch', 'name startYear endYear isActive');

    const result = populated.toObject();
    result.assignedSectionsCount = assignedSectionsCount;
    result.assignedTeacher = assignedTeacherDoc
      ? { _id: assignedTeacherDoc._id, name: assignedTeacherDoc.name, email: assignedTeacherDoc.email }
      : null;

    return res.status(201).json(result);
  } catch (error) {
    console.error('createSubject error:', error);
    return res.status(500).json({ message: 'Error creating subject', error: error.message });
  }
};

const getSubjects = async (req, res) => {
  try {
    const { department, semester, year, course, batch, isActive, includeArchived } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (semester) filter.semester = Number(semester);
    if (year) filter.year = Number(year);
    if (batch && batch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(batch)) {
        filter.batch = batch;
      }
    }

    if (includeArchived === 'true' || isActive === 'all') {
      // no isActive filter
    } else if (isActive === 'false' || isActive === 'archived') {
      filter.isActive = false;
    } else if (isActive === 'true' || isActive === 'active') {
      filter.isActive = { $ne: false };
    } else {
      // Default to active only
      filter.isActive = { $ne: false };
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        const deptIds = depts.map((d) => d._id);
        if (!filter.department) {
          filter.department = { $in: deptIds };
        }
      }
    }

    const subjects = await Subject.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('batch', 'name startYear endYear isActive')
      .sort({ year: 1, semester: 1, code: 1 });

    const subjectIds = subjects.map((s) => s._id);
    const assignments = await TeacherSubject.find({ subject: { $in: subjectIds } })
      .populate('teacher', 'name email employeeId department')
      .populate('section', 'name');

    const assignmentMap = {};
    for (const a of assignments) {
      const sId = a.subject.toString();
      if (!assignmentMap[sId]) {
        assignmentMap[sId] = [];
      }
      if (a.teacher) {
        assignmentMap[sId].push({
          teacher: a.teacher,
          section: a.section,
        });
      }
    }

    const enriched = subjects.map((s) => {
      const obj = s.toObject();
      const assList = assignmentMap[s._id.toString()] || [];
      obj.assignedTeachers = assList;
      obj.assignedTeacher = assList.length > 0 ? assList[0].teacher : null;
      return obj;
    });

    return res.status(200).json(enriched);
  } catch (error) {
    console.error('getSubjects error:', error);
    return res.status(500).json({ message: 'Error fetching subjects' });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, department, semester, year, credits, teacher, batch } = req.body;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    if (name) subject.name = name.trim();
    if (code) subject.code = code.toUpperCase().trim();
    if (department) subject.department = department;
    if (semester !== undefined) subject.semester = Number(semester);
    if (year !== undefined) {
      const yr = Number(year);
      if (yr < 1) {
        return res.status(400).json({ message: 'A valid Year is required.' });
      }
      subject.year = yr;
    }
    if (credits !== undefined) subject.credits = Number(credits);
    if (batch !== undefined) {
      subject.batch = batch && mongoose.Types.ObjectId.isValid(batch) ? batch : null;
    }

    await subject.save();

    let assignedSectionsCount = 0;
    let assignedTeacherDoc = null;

    if (teacher) {
      const teacherDoc = await User.findOne({ _id: teacher, role: 'teacher', isActive: true });
      if (teacherDoc) {
        assignedTeacherDoc = teacherDoc;
        const activeSession = await AcademicSession.findOne({ isActive: true });
        const matchingSections = await Section.find({
          department: subject.department,
          year: subject.year,
          semester: subject.semester,
        });

        if (activeSession && matchingSections.length > 0) {
          for (const sec of matchingSections) {
            await TeacherSubject.findOneAndUpdate(
              {
                teacher: teacherDoc._id,
                subject: subject._id,
                section: sec._id,
                session: activeSession._id,
              },
              {
                teacher: teacherDoc._id,
                subject: subject._id,
                section: sec._id,
                session: activeSession._id,
              },
              { upsert: true, new: true }
            );
          }
          assignedSectionsCount = matchingSections.length;
        }
      }
    }

    const populated = await Subject.findById(subject._id)
      .populate({
        path: 'department',
        populate: { path: 'course', select: 'name code durationYears' },
      })
      .populate('batch', 'name startYear endYear isActive');

    const result = populated.toObject();
    result.assignedSectionsCount = assignedSectionsCount;
    result.assignedTeacher = assignedTeacherDoc
      ? { _id: assignedTeacherDoc._id, name: assignedTeacherDoc.name, email: assignedTeacherDoc.email }
      : null;

    return res.status(200).json(result);
  } catch (error) {
    console.error('updateSubject error:', error);
    return res.status(500).json({ message: 'Error updating subject', error: error.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const [tsCount, slotCount, attCount] = await Promise.all([
      TeacherSubject.countDocuments({ subject: id }),
      PeriodSlot.countDocuments({ subject: id }),
      Attendance.countDocuments({ subject: id }),
    ]);

    const total = tsCount + slotCount + attCount;
    if (total > 0) {
      const parts = [];
      if (tsCount > 0) parts.push(`${tsCount} faculty allocation(s)`);
      if (slotCount > 0) parts.push(`${slotCount} timetable slot(s)`);
      if (attCount > 0) parts.push(`${attCount} attendance record(s)`);
      return res.status(409).json({
        message: `Cannot delete Subject '${subject.name}' (${subject.code}) -- it still has ${parts.join(', ')} associated with it. Reassign or remove these first.`,
      });
    }

    await Subject.findByIdAndDelete(id);
    return res.status(200).json({ message: `Subject '${subject.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteSubject error:', error);
    return res.status(500).json({ message: 'Error deleting subject', error: error.message });
  }
};

const forceDeleteSubject = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { id } = req.params;
    const subject = await Subject.findById(id).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Subject not found.' });
    }

    // 1. Cascade delete TeacherSubject allocations
    const tsResult = await TeacherSubject.deleteMany({ subject: id }, { session });

    // 2. Cascade delete PeriodSlot timetable scheduling
    const slotResult = await PeriodSlot.deleteMany({ subject: id }, { session });

    // 3. Cascade delete Attendance records
    const attResult = await Attendance.deleteMany({ subject: id }, { session });

    // 4. Delete the Subject itself
    await Subject.findByIdAndDelete(id, { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: `Subject '${subject.name}' (${subject.code}) and all associated dependencies (${tsResult.deletedCount} faculty allocations, ${slotResult.deletedCount} timetable slots, ${attResult.deletedCount} attendance records) have been permanently deleted.`,
      deletedSubject: {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
      },
      stats: {
        teacherSubjects: tsResult.deletedCount,
        periodSlots: slotResult.deletedCount,
        attendanceRecords: attResult.deletedCount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('forceDeleteSubject error:', error);
    return res.status(500).json({
      message: 'Error executing permanent cascade delete for subject',
      error: error.message,
    });
  }
};

const archiveSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    subject.isActive = false;
    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate({
        path: 'department',
        populate: { path: 'course', select: 'name code durationYears' },
      })
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json({
      message: `Subject '${subject.name}' (${subject.code}) has been archived successfully.`,
      subject: populated,
    });
  } catch (error) {
    console.error('archiveSubject error:', error);
    return res.status(500).json({ message: 'Error archiving subject', error: error.message });
  }
};

const restoreSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    subject.isActive = true;
    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate({
        path: 'department',
        populate: { path: 'course', select: 'name code durationYears' },
      })
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json({
      message: `Subject '${subject.name}' (${subject.code}) has been restored successfully.`,
      subject: populated,
    });
  } catch (error) {
    console.error('restoreSubject error:', error);
    return res.status(500).json({ message: 'Error restoring subject', error: error.message });
  }
};

const exportSubjectsCsv = async (req, res) => {
  try {
    const { course, department, semester, year, isActive, includeArchived } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (semester) filter.semester = Number(semester);
    if (year) filter.year = Number(year);

    if (includeArchived === 'true' || isActive === 'all') {
      // no isActive filter
    } else if (isActive === 'false' || isActive === 'archived') {
      filter.isActive = false;
    } else if (isActive === 'true' || isActive === 'active') {
      filter.isActive = { $ne: false };
    } else {
      filter.isActive = { $ne: false };
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    const subjects = await Subject.find(filter)
      .populate({ path: 'department', populate: { path: 'course' } })
      .sort({ year: 1, semester: 1, code: 1 });

    const rows = subjects.map((s) => ({
      courseCode: s.department?.course?.code || '',
      departmentCode: s.department?.code || '',
      name: s.name,
      code: s.code,
      year: s.year || Math.min(4, Math.max(1, Math.ceil((s.semester || 1) / 2))),
      semester: s.semester,
      credits: s.credits,
      status: s.isActive !== false ? 'Active' : 'Archived',
    }));
    const csvData = toCsv(rows, ['courseCode', 'departmentCode', 'name', 'code', 'year', 'semester', 'credits', 'status']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="subjects.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportSubjectsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting subjects CSV' });
  }
};

const exportSubjectsPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const { course, department, semester, year, isActive, includeArchived } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (semester) filter.semester = Number(semester);
    if (year) filter.year = Number(year);

    if (includeArchived === 'true' || isActive === 'all') {
      // no isActive filter
    } else if (isActive === 'false' || isActive === 'archived') {
      filter.isActive = false;
    } else if (isActive === 'true' || isActive === 'active') {
      filter.isActive = { $ne: false };
    } else {
      filter.isActive = { $ne: false };
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    const subjects = await Subject.find(filter)
      .populate({ path: 'department', populate: { path: 'course' } })
      .sort({ year: 1, semester: 1, code: 1 });

    const rows = subjects.map((s) => ({
      code: s.code,
      name: s.name,
      course: s.department?.course?.code || '—',
      department: s.department?.name || '—',
      year: `Year ${s.year || Math.min(4, Math.max(1, Math.ceil((s.semester || 1) / 2)))}`,
      semester: `Sem ${s.semester}`,
      credits: s.credits,
      status: s.isActive !== false ? 'Active' : 'Archived',
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Curriculum Subjects Master List',
      subtitle: 'Official course catalogue, subject codes, credit allocations, and year mappings',
      columns: [
        { header: 'Code', key: 'code', align: 'center' },
        { header: 'Subject Name', key: 'name' },
        { header: 'Program', key: 'course', align: 'center' },
        { header: 'Department', key: 'department' },
        { header: 'Year', key: 'year', align: 'center' },
        { header: 'Semester', key: 'semester', align: 'center' },
        { header: 'Credits', key: 'credits', align: 'center' },
        { header: 'Status', key: 'status', align: 'center' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="subjects.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportSubjectsPdf error:', err);
    return res.status(500).json({ message: 'Error generating subjects PDF', error: err.message });
  }
};

const importSubjectsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];
    const warnings = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    const departments = await Department.find().populate('course');
    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d._id);
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d._id);
      }
    });

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const name = (row.name || row.Name || '').trim();
      const code = (row.code || row.Code || '').toUpperCase().trim();
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.department || row.DepartmentCode || '').toUpperCase().trim();
      const sem = Number(row.semester || row.Semester || 1);
      const yearRaw = row.year || row.Year || '';
      const credits = Number(row.credits || row.Credits || 3);

      if (!name || !code || !deptCode) {
        errors.push({ row: lineNum, reason: 'Name, Code, and DepartmentCode are required.' });
        skipped++;
        continue;
      }

      let deptId = null;
      if (courseCode) {
        deptId = deptCompoundMap.get(`${courseCode}_${deptCode}`);
      } else {
        deptId = deptCompoundMap.get(deptCode);
      }

      if (!deptId) {
        errors.push({
          row: lineNum,
          reason: courseCode
            ? `No department '${deptCode}' found under course '${courseCode}' -- check spelling or create it first.`
            : `Department code '${deptCode}' not found.`,
        });
        skipped++;
        continue;
      }

      let yr = yearRaw ? Number(yearRaw) : Math.min(4, Math.max(1, Math.ceil(sem / 2)));
      if (isNaN(yr) || yr < 1) {
        errors.push({ row: lineNum, reason: `Invalid year '${yearRaw}'. Year must be positive integer.` });
        skipped++;
        continue;
      }

      const expectedYear = Math.min(4, Math.max(1, Math.ceil(sem / 2)));
      if (yr !== expectedYear) {
        warnings.push({
          row: lineNum,
          message: `semester ${sem} usually belongs to Year ${expectedYear}, but Year ${yr} was specified -- imported as specified, please verify`,
        });
      }

      let sub = await Subject.findOne({ code, department: deptId });
      if (sub) {
        sub.name = name;
        sub.semester = sem;
        sub.year = yr;
        sub.credits = credits;
        await sub.save();
        updated++;
      } else {
        sub = new Subject({
          name,
          code,
          department: deptId,
          semester: sem,
          year: yr,
          credits,
        });
        await sub.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
      warnings,
    });
  } catch (err) {
    console.error('importSubjectsCsv error:', err);
    return res.status(500).json({ message: 'Error importing subjects', error: err.message });
  }
};

// ==================== STUDENTS ====================
const createStudent = async (req, res) => {
  try {
    const { name, rollNumber, section, department, semester, year, email, phone, isActive, batch } = req.body;
    if (!name || !rollNumber || !section || !department || !semester) {
      return res.status(400).json({ message: 'Name, rollNumber, section, department, and semester are required.' });
    }

    const cleanRollNumber = rollNumber.toString().toUpperCase().trim();
    const existing = await Student.findOne({
      $or: [
        { department, rollNumber: new RegExp('^' + cleanRollNumber + '$', 'i') },
        { rollNumber: new RegExp('^' + cleanRollNumber + '$', 'i') },
      ],
    });
    if (existing) {
      return res.status(409).json({
        message: `Student with Roll Number '${cleanRollNumber}' already exists (${existing.isActive ? 'Active' : 'Inactive'}).`,
      });
    }

    if (phone && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    let studentYear = year ? Number(year) : null;
    if (!studentYear) {
      const secDoc = await Section.findById(section);
      studentYear = secDoc?.year || Math.min(4, Math.max(1, Math.ceil(Number(semester) / 2)));
    }

    const student = new Student({
      name: name.trim(),
      rollNumber: rollNumber.toUpperCase().trim(),
      section,
      department,
      batch: batch || null,
      semester: Number(semester),
      year: studentYear,
      email: email ? email.toLowerCase().trim() : '',
      phone: phone ? phone.trim() : '',
      isActive: isActive !== undefined ? isActive : true,
    });

    await student.save();
    const populated = await Student.findById(student._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createStudent error:', error);
    return res.status(500).json({ message: 'Error creating student', error: error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const { department, section, semester, year, course, search, isActive, batch } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    } else if (isActive === undefined) {
      filter.isActive = { $ne: false };
    }
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (semester) filter.semester = Number(semester);
    if (batch) filter.batch = batch;
    if (year) {
      if (year === 'missing') {
        filter.$or = [{ year: { $exists: false } }, { year: null }];
      } else {
        filter.year = Number(year);
      }
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        const deptIds = depts.map((d) => d._id);
        if (!filter.department) {
          filter.department = { $in: deptIds };
        }
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchClause = [
        { name: searchRegex },
        { rollNumber: searchRegex },
        { email: searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
        delete filter.$or;
      } else {
        filter.$or = searchClause;
      }
    }

    const students = await Student.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ year: 1, rollNumber: 1 });

    return res.status(200).json(students);
  } catch (error) {
    console.error('getStudents error:', error);
    return res.status(500).json({ message: 'Error fetching students' });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rollNumber, section, department, semester, year, email, phone, isActive, batch } = req.body;

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (phone !== undefined && phone !== '' && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    if (name) student.name = name.trim();
    if (rollNumber) student.rollNumber = rollNumber.toUpperCase().trim();
    if (section) student.section = section;
    if (department) student.department = department;
    if (batch !== undefined) student.batch = batch || null;
    if (semester) student.semester = Number(semester);
    if (year) {
      student.year = Number(year);
    } else if (section && section !== student.section?.toString()) {
      const secDoc = await Section.findById(section);
      if (secDoc?.year) student.year = secDoc.year;
    }
    if (email !== undefined) student.email = email.toLowerCase().trim();
    if (phone !== undefined) student.phone = phone ? phone.trim() : '';
    if (isActive !== undefined) student.isActive = isActive;

    await student.save();
    const populated = await Student.findById(id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateStudent error:', error);
    return res.status(500).json({ message: 'Error updating student', error: error.message });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const attCount = await Attendance.countDocuments({ 'records.student': id });
    if (attCount > 0) {
      student.isActive = false;
      await student.save();
      return res.status(200).json({
        message: `Student '${student.name}' has attendance history (${attCount} session(s)) and has been deactivated instead of deleted, to keep past reports accurate. They will no longer appear in active rosters or attendance-marking screens.`,
        softDeleted: true,
      });
    }

    await Student.findByIdAndDelete(id);
    return res.status(200).json({
      message: `Student '${student.name}' deleted permanently.`,
      softDeleted: false,
    });
  } catch (error) {
    console.error('deleteStudent error:', error);
    return res.status(500).json({ message: 'Error deleting student', error: error.message });
  }
};

const bulkImportStudents = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }

    const records = parseStudentCsv(req.file.buffer);
    if (!records || records.length === 0) {
      return res.status(400).json({ message: 'CSV file is empty or formatted incorrectly.' });
    }

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    const departments = await Department.find().populate('course');
    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d._id);
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d._id);
      }
    });

    const sections = await Section.find();
    const sectionMap = new Map();
    const sectionDocMap = new Map();
    sections.forEach((s) => {
      const key = `${s.department.toString()}_${s.name.toUpperCase()}`;
      sectionMap.set(key, s._id);
      sectionDocMap.set(key, s);
    });

    const batches = await Batch.find();
    const batchMap = new Map();
    batches.forEach((b) => {
      batchMap.set(`${b.course.toString()}_${b.name.toUpperCase()}`, b._id);
      if (!batchMap.has(b.name.toUpperCase())) {
        batchMap.set(b.name.toUpperCase(), b._id);
      }
    });

    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const [index, row] of records.entries()) {
      const lineNum = index + 2;
      try {
        if (!row.name || !row.rollNumber) {
          errors.push({ row: lineNum, reason: 'Name and Roll Number are required.' });
          skipped++;
          continue;
        }

        const courseCode = (row.courseCode || row.CourseCode || '').toUpperCase().trim();
        const deptCode = (row.departmentCode || row.DepartmentCode || '').toUpperCase().trim();

        let deptId = null;
        if (courseCode) {
          deptId = deptCompoundMap.get(`${courseCode}_${deptCode}`);
        } else {
          deptId = deptCompoundMap.get(deptCode);
        }

        if (!deptId) {
          errors.push({
            row: lineNum,
            reason: courseCode
              ? `No department '${deptCode}' found under course '${courseCode}' -- check spelling or create it first.`
              : `Invalid Department Code: ${deptCode}`,
          });
          skipped++;
          continue;
        }

        const secKey = `${deptId.toString()}_${row.sectionName.toUpperCase()}`;
        const secId = sectionMap.get(secKey);
        if (!secId) {
          errors.push({ row: lineNum, reason: `Section '${row.sectionName}' not found in department.` });
          skipped++;
          continue;
        }

        const secDoc = sectionDocMap.get(secKey);
        const resolvedYear = row.year || secDoc?.year || Math.min(4, Math.max(1, Math.ceil(row.semester / 2)));

        const batchRaw = (row.batch || row.batchName || row.Batch || row.BatchName || '').toUpperCase().trim();
        let batchId = null;
        if (batchRaw) {
          const courseDoc = courseCode ? courseMap.get(courseCode) : null;
          if (courseDoc) {
            batchId = batchMap.get(`${courseDoc._id.toString()}_${batchRaw}`) || batchMap.get(batchRaw);
          } else {
            batchId = batchMap.get(batchRaw);
          }
        }

        let cleanPhone = '';
        if (row.phone) {
          const norm = normalizeCsvPhone(row.phone);
          if (norm === null) {
            errors.push({
              row: lineNum,
              reason: `Invalid Indian phone number '${row.phone}'. Must be a 10-digit number starting with 6-9.`,
            });
            skipped++;
            continue;
          }
          cleanPhone = norm;
        }

        const cleanRoll = row.rollNumber.toString().trim();
        let existing = await Student.findOne({
          department: deptId,
          rollNumber: new RegExp('^' + cleanRoll + '$', 'i'),
        });
        if (!existing) {
          existing = await Student.findOne({
            rollNumber: new RegExp('^' + cleanRoll + '$', 'i'),
          });
        }

        if (existing) {
          existing.name = row.name.toString().trim();
          existing.section = secId;
          existing.department = deptId;
          existing.semester = row.semester || 1;
          existing.year = resolvedYear;
          if (batchId) existing.batch = batchId;
          if (row.email) existing.email = row.email.toString().toLowerCase().trim();
          if (cleanPhone) existing.phone = cleanPhone;
          existing.isActive = true;
          await existing.save();
          updated++;
        } else {
          const newStudent = new Student({
            name: row.name.toString().trim(),
            rollNumber: cleanRoll.toUpperCase(),
            section: secId,
            department: deptId,
            batch: batchId || null,
            semester: row.semester || 1,
            year: resolvedYear,
            email: row.email ? row.email.toString().toLowerCase().trim() : '',
            phone: cleanPhone,
            isActive: true,
          });
          await newStudent.save();
          created++;
        }
      } catch (err) {
        errors.push({ row: lineNum, reason: err.message });
        skipped++;
      }
    }

    return res.status(200).json({
      message: `Bulk import completed: ${created} created, ${updated} updated, ${skipped} skipped.`,
      totalRows: records.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (error) {
    console.error('bulkImportStudents error:', error);
    return res.status(500).json({ message: 'Error processing bulk CSV import', error: error.message });
  }
};

const detectDuplicateStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ rollNumber: 1, createdAt: 1 });

    const rollMap = new Map();
    for (const st of students) {
      const roll = (st.rollNumber || '').trim().toUpperCase();
      if (!roll) continue;
      if (!rollMap.has(roll)) rollMap.set(roll, []);
      rollMap.get(roll).push(st);
    }

    const emailMap = new Map();
    for (const st of students) {
      const email = (st.email || '').trim().toLowerCase();
      if (!email) continue;
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push(st);
    }

    const duplicateGroups = [];
    const processedStudentIds = new Set();

    const getAttCount = async (studentId) => {
      return await Attendance.countDocuments({ 'records.student': studentId });
    };

    // 1. Process rollNumber duplicates
    for (const [roll, group] of rollMap.entries()) {
      if (group.length > 1) {
        group.forEach((s) => processedStudentIds.add(s._id.toString()));
        const enriched = [];
        for (const s of group) {
          const attCount = await getAttCount(s._id);
          enriched.push({
            ...s.toObject(),
            attendanceCount: attCount,
          });
        }
        enriched.sort((a, b) => {
          if (b.attendanceCount !== a.attendanceCount) return b.attendanceCount - a.attendanceCount;
          if (b.isActive !== a.isActive) return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        duplicateGroups.push({
          type: 'rollNumber',
          key: roll,
          title: `Duplicate Roll Number: ${roll}`,
          recommendedKeepId: enriched[0]._id.toString(),
          students: enriched,
        });
      }
    }

    // 2. Process email duplicates not already processed
    for (const [email, group] of emailMap.entries()) {
      if (group.length > 1) {
        const remaining = group.filter((s) => !processedStudentIds.has(s._id.toString()));
        if (remaining.length > 1) {
          remaining.forEach((s) => processedStudentIds.add(s._id.toString()));
          const enriched = [];
          for (const s of remaining) {
            const attCount = await getAttCount(s._id);
            enriched.push({
              ...s.toObject(),
              attendanceCount: attCount,
            });
          }
          enriched.sort((a, b) => {
            if (b.attendanceCount !== a.attendanceCount) return b.attendanceCount - a.attendanceCount;
            if (b.isActive !== a.isActive) return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          duplicateGroups.push({
            type: 'email',
            key: email,
            title: `Duplicate Email: ${email}`,
            recommendedKeepId: enriched[0]._id.toString(),
            students: enriched,
          });
        }
      }
    }

    return res.status(200).json({
      totalGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((acc, g) => acc + g.students.length, 0),
      groups: duplicateGroups,
    });
  } catch (error) {
    console.error('detectDuplicateStudents error:', error);
    return res.status(500).json({ message: 'Error detecting duplicate students', error: error.message });
  }
};

const resolveDuplicateStudents = async (req, res) => {
  try {
    const { resolutions } = req.body;
    if (!resolutions || !Array.isArray(resolutions) || resolutions.length === 0) {
      return res.status(400).json({ message: 'Resolutions array is required.' });
    }

    let totalMergedAttendance = 0;
    let totalRemoved = 0;

    for (const resItem of resolutions) {
      const { keepId, removeIds, mergeAttendance = true } = resItem;
      if (!keepId || !removeIds || !Array.isArray(removeIds) || removeIds.length === 0) {
        continue;
      }

      const canonicalStudent = await Student.findById(keepId);
      if (!canonicalStudent) continue;

      for (const removeId of removeIds) {
        if (removeId.toString() === keepId.toString()) continue;

        if (mergeAttendance) {
          const attendances = await Attendance.find({ 'records.student': removeId });
          for (const att of attendances) {
            const hasKeepId = att.records.some((r) => r.student && r.student.toString() === keepId.toString());
            if (hasKeepId) {
              const removeRecord = att.records.find((r) => r.student && r.student.toString() === removeId.toString());
              if (removeRecord?.status === 'present') {
                const keepRecord = att.records.find((r) => r.student && r.student.toString() === keepId.toString());
                if (keepRecord) keepRecord.status = 'present';
              }
              att.records = att.records.filter((r) => r.student && r.student.toString() !== removeId.toString());
              await att.save();
              totalMergedAttendance++;
            } else {
              await Attendance.updateOne(
                { _id: att._id, 'records.student': removeId },
                { $set: { 'records.$.student': keepId } }
              );
              totalMergedAttendance++;
            }
          }
        }

        await Student.findByIdAndDelete(removeId);
        totalRemoved++;
      }

      canonicalStudent.isActive = true;
      await canonicalStudent.save();
    }

    return res.status(200).json({
      message: `Successfully resolved duplicate students. Removed ${totalRemoved} record(s) and remapped ${totalMergedAttendance} attendance record(s).`,
      totalRemoved,
      totalMergedAttendance,
    });
  } catch (error) {
    console.error('resolveDuplicateStudents error:', error);
    return res.status(500).json({ message: 'Error resolving duplicate students', error: error.message });
  }
};

const exportStudentsCsv = async (req, res) => {
  try {
    const { department, section, semester, year, course, search, isActive, batch } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (semester) filter.semester = Number(semester);
    if (batch) filter.batch = batch;
    if (year) {
      if (year === 'missing') {
        filter.$or = [{ year: { $exists: false } }, { year: null }];
      } else {
        filter.year = Number(year);
      }
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchClause = [
        { name: searchRegex },
        { rollNumber: searchRegex },
        { email: searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
        delete filter.$or;
      } else {
        filter.$or = searchClause;
      }
    }

    const students = await Student.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name')
      .sort({ year: 1, rollNumber: 1 });

    const rows = students.map((s) => ({
      name: s.name,
      rollNumber: s.rollNumber,
      courseCode: s.department?.course?.code || '',
      departmentCode: s.department?.code || '',
      sectionName: s.section?.name || '',
      year: s.year || 1,
      semester: s.semester,
      batchName: s.batch?.name || '',
      email: s.email || '',
      phone: s.phone || '',
      isActive: s.isActive ? 'Active' : 'Inactive',
    }));

    const csvData = toCsv(rows, [
      'name',
      'rollNumber',
      'courseCode',
      'departmentCode',
      'sectionName',
      'year',
      'semester',
      'batchName',
      'email',
      'phone',
      'isActive',
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportStudentsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting students CSV' });
  }
};

const exportStudentsPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const { department, section, semester, year, course, search, isActive, batch } = req.query;
    const filter = {};
    if (isActive !== undefined && isActive !== 'all') {
      filter.isActive = isActive === 'true' || isActive === true;
    }
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (semester) filter.semester = Number(semester);
    if (batch) filter.batch = batch;
    if (year) {
      if (year === 'missing') {
        filter.$or = [{ year: { $exists: false } }, { year: null }];
      } else {
        filter.year = Number(year);
      }
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        filter.department = { $in: depts.map((d) => d._id) };
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchClause = [
        { name: searchRegex },
        { rollNumber: searchRegex },
        { email: searchRegex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
        delete filter.$or;
      } else {
        filter.$or = searchClause;
      }
    }

    const students = await Student.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('section', 'name semester year')
      .populate('batch', 'name')
      .sort({ year: 1, rollNumber: 1 });

    const rows = students.map((s) => ({
      rollNumber: s.rollNumber,
      name: s.name,
      course: s.department?.course?.code || '—',
      department: s.department?.name || '—',
      section: s.section?.name || '—',
      year: `Year ${s.year || 1}`,
      semester: `Sem ${s.semester}`,
      batch: s.batch?.name || '—',
      phone: s.phone || '—',
      status: s.isActive ? 'Active' : 'Inactive',
    }));

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Student Records Official Roster',
      subtitle: 'Enrolled students, academic cohorts, and cohort batch assignments',
      columns: [
        { header: 'Roll Number', key: 'rollNumber', align: 'center' },
        { header: 'Student Name', key: 'name' },
        { header: 'Program', key: 'course', align: 'center' },
        { header: 'Department', key: 'department' },
        { header: 'Section', key: 'section', align: 'center' },
        { header: 'Year', key: 'year', align: 'center' },
        { header: 'Sem', key: 'semester', align: 'center' },
        { header: 'Batch', key: 'batch', align: 'center' },
        { header: 'Contact Phone', key: 'phone', align: 'center' },
        {
          header: 'Status',
          render: (r) => `<span class="badge ${r.status === 'Active' ? 'badge-green' : 'badge-rose'}">${r.status}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="students.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportStudentsPdf error:', err);
    return res.status(500).json({ message: 'Error generating students PDF', error: err.message });
  }
};

const backfillMissingYears = async (req, res) => {
  try {
    const sections = await Section.find();
    let updatedSectionsCount = 0;

    for (const sec of sections) {
      if (!sec.year || ![1, 2, 3, 4].includes(sec.year)) {
        const calculatedYear = Math.min(4, Math.max(1, Math.ceil((sec.semester || 1) / 2)));
        sec.year = calculatedYear;
        await sec.save();
        updatedSectionsCount++;
      }
    }

    const allSections = await Section.find().select('_id year');
    const secYearMap = new Map();
    allSections.forEach((s) => secYearMap.set(s._id.toString(), s.year));

    const students = await Student.find();
    let updatedStudentsCount = 0;

    for (const st of students) {
      const expectedYear = secYearMap.get(st.section?.toString()) || Math.min(4, Math.max(1, Math.ceil((st.semester || 1) / 2)));
      if (!st.year || st.year !== expectedYear) {
        st.year = expectedYear;
        await st.save();
        updatedStudentsCount++;
      }
    }

    const subjects = await Subject.find();
    let updatedSubjectsCount = 0;

    for (const sub of subjects) {
      if (!sub.year || ![1, 2, 3, 4].includes(sub.year)) {
        sub.year = Math.min(4, Math.max(1, Math.ceil((sub.semester || 1) / 2)));
        await sub.save();
        updatedSubjectsCount++;
      }
    }

    return res.status(200).json({
      message: `Backfill completed successfully. Updated ${updatedSectionsCount} section(s), ${updatedStudentsCount} student(s), and ${updatedSubjectsCount} subject(s).`,
      updatedSectionsCount,
      updatedStudentsCount,
      updatedSubjectsCount,
    });
  } catch (error) {
    console.error('backfillMissingYears error:', error);
    return res.status(500).json({ message: 'Error backfilling year field', error: error.message });
  }
};

// ==================== PERIOD SLOTS (Timetable & Conflict Check) ====================
const createPeriodSlot = async (req, res) => {
  try {
    const { section, dayOfWeek, periodNumber, startTime, endTime, subject, teacher, session, isRecess, recessLabel, batch } = req.body;
    const isRecessBool = Boolean(isRecess);

    if (section === undefined || dayOfWeek === undefined || periodNumber === undefined || !startTime || !endTime || !session) {
      return res.status(400).json({ message: 'Section, dayOfWeek, periodNumber, timings, and session are required.' });
    }

    if (isRecessBool) {
      if (!recessLabel || !recessLabel.trim()) {
        return res.status(400).json({ message: 'Recess label (e.g., Lunch Break) is required when slot is marked as Recess.' });
      }
    } else {
      if (!subject || !teacher) {
        return res.status(400).json({ message: 'Subject and Teacher are required for regular teaching slots.' });
      }
    }

    const secDoc = await Section.findById(section);
    if (!secDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // Course + Year HOD Verification: Validate section.year matches req.user.year AND section.department.course matches req.user.course
    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      const secYear = Number(secDoc.year);
      
      const secDept = await Department.findById(secDoc.department);
      const secCourseId = secDept?.course?.toString();

      if (!userYear || secYear !== userYear || !userCourseId || secCourseId !== userCourseId) {
        return res.status(403).json({
          message: `Access denied. HOD can only manage timetable for their assigned course and year.`,
        });
      }
    }

    let slotBatch = null;
    if (batch && mongoose.Types.ObjectId.isValid(batch)) {
      slotBatch = batch;
    } else if (secDoc.batch) {
      slotBatch = secDoc.batch;
    }

    const dayNum = Number(dayOfWeek);
    const pNum = Number(periodNumber);

    // 1. Conflict Prevention: Is the SAME teacher already scheduled at this day+period+session in another section? (Skip for Recess)
    if (!isRecessBool && teacher) {
      const teacherConflict = await PeriodSlot.findOne({
        teacher,
        dayOfWeek: dayNum,
        periodNumber: pNum,
        session,
        isRecess: { $ne: true },
      })
        .populate('section', 'name')
        .populate('subject', 'name code')
        .populate('teacher', 'name');

      if (teacherConflict) {
        return res.status(409).json({
          message: `Teacher Collision: ${teacherConflict.teacher?.name || 'This teacher'} is already scheduled for '${teacherConflict.subject?.name || 'Class'}' in section '${teacherConflict.section?.name || 'another section'}' on Period #${pNum} (${INT_TO_DAY_NAME[dayNum]}).`,
        });
      }
    }

    // 2. Conflict Prevention: Is this section already occupied for this day+period?
    const existingSectionSlot = await PeriodSlot.findOne({
      section,
      dayOfWeek: dayNum,
      periodNumber: pNum,
      session,
    });

    if (existingSectionSlot) {
      return res.status(409).json({
        message: `Section Collision: A slot is already scheduled for this section on Period #${pNum} (${INT_TO_DAY_NAME[dayNum]}).`,
      });
    }

    // Enforce or Create PeriodTemplate for this (section, periodNumber)
    let template = await PeriodTemplate.findOne({ section, periodNumber: pNum });
    let slotStartTime = startTime.trim();
    let slotEndTime = endTime.trim();

    if (template) {
      slotStartTime = template.startTime;
      slotEndTime = template.endTime;
    } else {
      template = new PeriodTemplate({
        section,
        periodNumber: pNum,
        startTime: slotStartTime,
        endTime: slotEndTime,
      });
      await template.save();
    }

    const slot = new PeriodSlot({
      section,
      dayOfWeek: dayNum,
      periodNumber: pNum,
      startTime: slotStartTime,
      endTime: slotEndTime,
      subject: isRecessBool ? null : subject,
      teacher: isRecessBool ? null : teacher,
      session,
      isRecess: isRecessBool,
      recessLabel: isRecessBool ? recessLabel.trim() : '',
      batch: slotBatch,
    });

    await slot.save();
    const populated = await PeriodSlot.findById(slot._id)
      .populate({
        path: 'section',
        populate: { path: 'department', select: 'name code course' },
      })
      .populate('subject', 'name code')
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('session', 'year semesterLabel')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createPeriodSlot error:', error);
    return res.status(500).json({ message: 'Error creating period slot', error: error.message });
  }
};

const updatePeriodSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { section, dayOfWeek, periodNumber, startTime, endTime, subject, teacher, session, isRecess, recessLabel, batch } = req.body;

    const slot = await PeriodSlot.findById(id).populate('section');
    if (!slot) {
      return res.status(404).json({ message: 'Period slot not found.' });
    }

    // Course + Year HOD Verification for existing slot
    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      
      const currentSec = slot.section;
      const currentYear = Number(currentSec?.year);
      const currentDept = await Department.findById(currentSec?.department);
      const currentCourseId = currentDept?.course?.toString();

      if (!userYear || currentYear !== userYear || !userCourseId || currentCourseId !== userCourseId) {
        return res.status(403).json({
          message: `Access denied. HOD can only manage timetable for their assigned course and year.`,
        });
      }

      // If updating section, verify target section belongs to HOD's course + year
      if (section && section.toString() !== slot.section?._id?.toString()) {
        const newSecDoc = await Section.findById(section);
        if (!newSecDoc) {
          return res.status(404).json({ message: 'Target section not found.' });
        }
        const newDept = await Department.findById(newSecDoc.department);
        const newCourseId = newDept?.course?.toString();
        if (Number(newSecDoc.year) !== userYear || newCourseId !== userCourseId) {
          return res.status(403).json({
            message: `Access denied. HOD can only manage timetable for their assigned course and year.`,
          });
        }
      }
    }

    const isRecessBool = isRecess !== undefined ? Boolean(isRecess) : slot.isRecess;
    const targetSection = section || slot.section?._id || slot.section;
    const targetDay = dayOfWeek !== undefined ? Number(dayOfWeek) : slot.dayOfWeek;
    const targetPNum = periodNumber !== undefined ? Number(periodNumber) : slot.periodNumber;
    const targetSession = session || slot.session;
    const targetTeacher = isRecessBool ? null : (teacher !== undefined ? teacher : slot.teacher);
    const targetSubject = isRecessBool ? null : (subject !== undefined ? subject : slot.subject);
    const targetRecessLabel = isRecessBool ? (recessLabel !== undefined ? recessLabel.trim() : slot.recessLabel) : '';

    if (isRecessBool) {
      if (!targetRecessLabel) {
        return res.status(400).json({ message: 'Recess label is required when slot is marked as Recess.' });
      }
    } else {
      if (!targetSubject || !targetTeacher) {
        return res.status(400).json({ message: 'Subject and Teacher are required for regular teaching slots.' });
      }
    }

    // 1. Conflict Prevention: Teacher collision (skip if isRecess)
    if (!isRecessBool && targetTeacher) {
      const teacherConflict = await PeriodSlot.findOne({
        _id: { $ne: id },
        teacher: targetTeacher,
        dayOfWeek: targetDay,
        periodNumber: targetPNum,
        session: targetSession,
        isRecess: { $ne: true },
      })
        .populate('section', 'name')
        .populate('subject', 'name code')
        .populate('teacher', 'name');

      if (teacherConflict) {
        return res.status(409).json({
          message: `Teacher Collision: ${teacherConflict.teacher?.name || 'This teacher'} is already scheduled for '${teacherConflict.subject?.name || 'Class'}' in section '${teacherConflict.section?.name || 'another section'}' on Period #${targetPNum} (${INT_TO_DAY_NAME[targetDay]}).`,
        });
      }
    }

    // 2. Conflict Prevention: Section slot collision
    const sectionSlotConflict = await PeriodSlot.findOne({
      _id: { $ne: id },
      section: targetSection,
      dayOfWeek: targetDay,
      periodNumber: targetPNum,
      session: targetSession,
    });

    if (sectionSlotConflict) {
      return res.status(409).json({
        message: `Section Collision: A slot is already scheduled for this section on Period #${targetPNum} (${INT_TO_DAY_NAME[targetDay]}).`,
      });
    }

    // Check PeriodTemplate
    let template = await PeriodTemplate.findOne({ section: targetSection, periodNumber: targetPNum });
    let slotStartTime = (startTime || slot.startTime || '').trim();
    let slotEndTime = (endTime || slot.endTime || '').trim();

    if (template) {
      slotStartTime = template.startTime;
      slotEndTime = template.endTime;
    } else if (slotStartTime && slotEndTime) {
      template = new PeriodTemplate({
        section: targetSection,
        periodNumber: targetPNum,
        startTime: slotStartTime,
        endTime: slotEndTime,
      });
      await template.save();
    }

    if (section) slot.section = section;
    if (dayOfWeek !== undefined) slot.dayOfWeek = targetDay;
    if (periodNumber !== undefined) slot.periodNumber = targetPNum;
    if (slotStartTime) slot.startTime = slotStartTime;
    if (slotEndTime) slot.endTime = slotEndTime;
    slot.subject = targetSubject;
    slot.teacher = targetTeacher;
    if (session) slot.session = targetSession;
    slot.isRecess = isRecessBool;
    slot.recessLabel = targetRecessLabel;
    if (batch !== undefined) {
      slot.batch = batch && mongoose.Types.ObjectId.isValid(batch) ? batch : null;
    }

    await slot.save();

    const populated = await PeriodSlot.findById(id)
      .populate({
        path: 'section',
        populate: { path: 'department', select: 'name code course' },
      })
      .populate('subject', 'name code')
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('session', 'year semesterLabel')
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('updatePeriodSlot error:', error);
    return res.status(500).json({ message: 'Error updating period slot', error: error.message });
  }
};

// ==================== PERIOD TEMPLATES (Section-Level Timing Consistency) ====================
const getPeriodTemplates = async (req, res) => {
  try {
    const { section } = req.query;
    if (!section) {
      return res.status(400).json({ message: 'Section query parameter is required.' });
    }

    const templates = await PeriodTemplate.find({ section }).sort({ periodNumber: 1 });
    return res.status(200).json(templates);
  } catch (error) {
    console.error('getPeriodTemplates error:', error);
    return res.status(500).json({ message: 'Error fetching period templates', error: error.message });
  }
};

const updatePeriodTemplate = async (req, res) => {
  try {
    const { section, periodNumber, startTime, endTime } = req.body;
    if (!section || periodNumber === undefined || !startTime || !endTime) {
      return res.status(400).json({ message: 'Section, periodNumber, startTime, and endTime are required.' });
    }

    const pNum = Number(periodNumber);
    const secDoc = await Section.findById(section);
    if (!secDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // HOD Scope Verification
    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      const secDept = await Department.findById(secDoc.department);
      const secCourseId = secDept?.course?.toString();
      if (!userYear || Number(secDoc.year) !== userYear || !userCourseId || secCourseId !== userCourseId) {
        return res.status(403).json({ message: 'Access denied. HOD can only manage timetable for their assigned course and year.' });
      }
    }

    // Upsert PeriodTemplate
    const template = await PeriodTemplate.findOneAndUpdate(
      { section, periodNumber: pNum },
      { section, periodNumber: pNum, startTime: startTime.trim(), endTime: endTime.trim() },
      { upsert: true, new: true }
    );

    // Propagate to all PeriodSlots for this section and periodNumber
    const updateResult = await PeriodSlot.updateMany(
      { section, periodNumber: pNum },
      { startTime: startTime.trim(), endTime: endTime.trim() }
    );

    return res.status(200).json({
      template,
      affectedSlotsCount: updateResult.modifiedCount,
      message: `Period #${pNum} timings updated to ${startTime} - ${endTime} across ${updateResult.modifiedCount} scheduled day(s).`,
    });
  } catch (error) {
    console.error('updatePeriodTemplate error:', error);
    return res.status(500).json({ message: 'Error updating period template', error: error.message });
  }
};

const deletePeriodTemplate = async (req, res) => {
  const { sectionId, periodNumber } = req.params;
  if (!sectionId || periodNumber === undefined) {
    return res.status(400).json({ message: 'sectionId and periodNumber are required parameters.' });
  }

  const pNum = Number(periodNumber);
  if (isNaN(pNum) || pNum < 1) {
    return res.status(400).json({ message: 'Invalid period number.' });
  }

  try {
    const secDoc = await Section.findById(sectionId);
    if (!secDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // HOD Scope Verification
    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      const secDept = await Department.findById(secDoc.department);
      const secCourseId = secDept?.course?.toString();

      let rawBatches = req.user.assignedBatches || req.user.batches || req.user.batch || [];
      if (!Array.isArray(rawBatches)) rawBatches = [rawBatches];
      const batchIds = rawBatches.map((b) => (b && b._id ? b._id.toString() : b ? b.toString() : '')).filter(Boolean);

      if (batchIds.length > 0 && secDoc.batch) {
        const secBatchId = secDoc.batch._id ? secDoc.batch._id.toString() : secDoc.batch.toString();
        if (!batchIds.includes(secBatchId)) {
          return res.status(403).json({ message: 'Access denied. Section does not belong to your managed batch(es).' });
        }
      } else if (userYear && Number(secDoc.year) !== userYear) {
        return res.status(403).json({ message: 'Access denied. HOD can only manage timetable for their assigned course and year.' });
      } else if (userCourseId && secCourseId !== userCourseId) {
        return res.status(403).json({ message: 'Access denied. HOD can only manage timetable for their assigned course.' });
      }
    }

    // Mongoose Transaction attempt
    let mongoSession = null;
    try {
      mongoSession = await mongoose.startSession();
      mongoSession.startTransaction();
    } catch (sessionInitErr) {
      mongoSession = null;
    }

    try {
      const sessionOpts = mongoSession ? { session: mongoSession } : {};

      // Check if any PeriodTemplates exist for this section
      const existingTemplates = await PeriodTemplate.find({ section: sectionId }, null, sessionOpts);

      if (existingTemplates.length === 0) {
        // If no explicit template records existed yet, populate default templates 1..8 excluding deleted pNum
        const defaultPeriods = [1, 2, 3, 4, 5, 6, 7, 8].filter((n) => n !== pNum);
        const defaultTimings = {
          1: { start: '09:00', end: '10:00' },
          2: { start: '10:15', end: '11:15' },
          3: { start: '11:30', end: '12:30' },
          4: { start: '13:30', end: '14:30' },
          5: { start: '14:45', end: '15:45' },
          6: { start: '16:00', end: '17:00' },
          7: { start: '17:15', end: '18:15' },
          8: { start: '18:30', end: '19:30' },
        };

        const docsToInsert = defaultPeriods.map((n) => ({
          section: sectionId,
          periodNumber: n,
          startTime: defaultTimings[n].start,
          endTime: defaultTimings[n].end,
        }));

        await PeriodTemplate.insertMany(docsToInsert, sessionOpts);
      } else {
        // Delete specific PeriodTemplate document
        await PeriodTemplate.findOneAndDelete({ section: sectionId, periodNumber: pNum }, sessionOpts);
      }

      // Cascade delete all scheduled PeriodSlots for this section and periodNumber
      const deletedSlots = await PeriodSlot.deleteMany({ section: sectionId, periodNumber: pNum }, sessionOpts);

      if (mongoSession) {
        await mongoSession.commitTransaction();
      }

      return res.status(200).json({
        success: true,
        message: `Period #${pNum} row and its ${deletedSlots.deletedCount || 0} scheduled slot(s) were permanently deleted for section '${secDoc.name}'.`,
        deletedSlotsCount: deletedSlots.deletedCount || 0,
      });
    } catch (txErr) {
      if (mongoSession) {
        await mongoSession.abortTransaction();
      }
      throw txErr;
    } finally {
      if (mongoSession) {
        mongoSession.endSession();
      }
    }
  } catch (error) {
    console.error('deletePeriodTemplate error:', error);
    return res.status(500).json({ message: 'Error deleting period row', error: error.message });
  }
};

const getPeriodTimingInconsistencies = async (req, res) => {
  try {
    const { section } = req.query;
    const filter = {};
    if (section) filter.section = section;

    const slots = await PeriodSlot.find(filter)
      .populate('section', 'name year department')
      .sort({ section: 1, periodNumber: 1, dayOfWeek: 1 });

    // Group by section._id + periodNumber
    const groups = {};
    for (const slot of slots) {
      const sId = slot.section?._id?.toString() || slot.section?.toString();
      const pNum = slot.periodNumber;
      const key = `${sId}_${pNum}`;

      if (!groups[key]) {
        groups[key] = {
          section: slot.section,
          periodNumber: pNum,
          slots: [],
          timeVariants: {},
        };
      }
      groups[key].slots.push(slot);
      const timeKey = `${slot.startTime || ''} - ${slot.endTime || ''}`;
      if (!groups[key].timeVariants[timeKey]) {
        groups[key].timeVariants[timeKey] = {
          startTime: slot.startTime,
          endTime: slot.endTime,
          days: [],
          count: 0,
        };
      }
      groups[key].timeVariants[timeKey].days.push(INT_TO_DAY_NAME[slot.dayOfWeek] || `Day ${slot.dayOfWeek}`);
      groups[key].timeVariants[timeKey].count++;
    }

    const inconsistencies = [];
    for (const key of Object.keys(groups)) {
      const g = groups[key];
      const variantKeys = Object.keys(g.timeVariants);
      if (variantKeys.length > 1) {
        inconsistencies.push({
          sectionId: g.section?._id || g.section,
          sectionName: g.section?.name || 'Section',
          periodNumber: g.periodNumber,
          variants: Object.values(g.timeVariants),
          totalSlots: g.slots.length,
        });
      }
    }

    return res.status(200).json(inconsistencies);
  } catch (error) {
    console.error('getPeriodTimingInconsistencies error:', error);
    return res.status(500).json({ message: 'Error detecting period inconsistencies', error: error.message });
  }
};

const resolvePeriodTimingInconsistency = async (req, res) => {
  try {
    const { sectionId, periodNumber, canonicalStartTime, canonicalEndTime } = req.body;
    if (!sectionId || periodNumber === undefined || !canonicalStartTime || !canonicalEndTime) {
      return res.status(400).json({ message: 'sectionId, periodNumber, canonicalStartTime, and canonicalEndTime are required.' });
    }

    const pNum = Number(periodNumber);
    const secDoc = await Section.findById(sectionId);
    if (!secDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // Upsert PeriodTemplate
    const template = await PeriodTemplate.findOneAndUpdate(
      { section: sectionId, periodNumber: pNum },
      { section: sectionId, periodNumber: pNum, startTime: canonicalStartTime.trim(), endTime: canonicalEndTime.trim() },
      { upsert: true, new: true }
    );

    // Update all period slots for this section & period
    const updateResult = await PeriodSlot.updateMany(
      { section: sectionId, periodNumber: pNum },
      { startTime: canonicalStartTime.trim(), endTime: canonicalEndTime.trim() }
    );

    return res.status(200).json({
      success: true,
      template,
      updatedSlotsCount: updateResult.modifiedCount,
      message: `Inconsistency resolved. All Period #${pNum} slots for section '${secDoc.name}' unified to ${canonicalStartTime} - ${canonicalEndTime}.`,
    });
  } catch (error) {
    console.error('resolvePeriodTimingInconsistency error:', error);
    return res.status(500).json({ message: 'Error resolving period inconsistency', error: error.message });
  }
};

const getPeriodSlots = async (req, res) => {
  try {
    const { section, department, dayOfWeek, teacher, session, year, course, batch } = req.query;
    const filter = {};
    if (section) filter.section = section;
    if (dayOfWeek !== undefined) filter.dayOfWeek = Number(dayOfWeek);
    if (teacher) filter.teacher = teacher;
    if (session) filter.session = session;
    if (batch && batch !== 'all') {
      if (mongoose.Types.ObjectId.isValid(batch)) {
        filter.batch = batch;
      }
    }

    let query = PeriodSlot.find(filter)
      .populate({
        path: 'section',
        populate: { path: 'department', populate: { path: 'course', select: 'name code durationYears' } },
      })
      .populate('subject', 'name code semester')
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('session', 'year semesterLabel')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    const slots = await query;
    let filteredSlots = slots;

    if (department) {
      filteredSlots = filteredSlots.filter(
        (slot) =>
          slot.section?.department?._id?.toString() === department ||
          slot.section?.department?.toString() === department ||
          slot.section?.department?.code === department
      );
    }

    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      if (userCourseId) {
        const hodDepts = await Department.find({ course: userCourseId }).select('_id');
        const hodDeptIds = hodDepts.map((d) => d._id.toString());
        filteredSlots = filteredSlots.filter((slot) => {
          const sDeptId = slot.section?.department?._id?.toString() || slot.section?.department?.toString();
          return Number(slot.section?.year) === userYear && hodDeptIds.includes(sDeptId);
        });
      } else {
        filteredSlots = filteredSlots.filter((slot) => Number(slot.section?.year) === userYear);
      }
    } else {
      if (course) {
        const courseDoc = mongoose.Types.ObjectId.isValid(course)
          ? await Course.findById(course)
          : await Course.findOne({ code: course.toUpperCase().trim() });
        if (courseDoc) {
          const depts = await Department.find({ course: courseDoc._id }).select('_id');
          const dIds = depts.map((d) => d._id.toString());
          filteredSlots = filteredSlots.filter((slot) => {
            const sDeptId = slot.section?.department?._id?.toString() || slot.section?.department?.toString();
            return dIds.includes(sDeptId);
          });
        }
      }
      if (year) {
        filteredSlots = filteredSlots.filter((slot) => Number(slot.section?.year) === Number(year));
      }
    }

    return res.status(200).json(filteredSlots);
  } catch (error) {
    console.error('getPeriodSlots error:', error);
    return res.status(500).json({ message: 'Error fetching period slots' });
  }
};

const deletePeriodSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const slot = await PeriodSlot.findById(id).populate('section');
    if (!slot) {
      return res.status(404).json({ message: 'Period slot not found.' });
    }

    // Course + Year HOD Verification
    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      const secYear = Number(slot.section?.year);
      const secDept = await Department.findById(slot.section?.department);
      const secCourseId = secDept?.course?.toString();

      if (!userYear || secYear !== userYear || !userCourseId || secCourseId !== userCourseId) {
        return res.status(403).json({
          message: `Access denied. HOD can only manage timetable for their assigned course and year.`,
        });
      }
    }

    await PeriodSlot.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Period slot deleted successfully.' });
  } catch (error) {
    console.error('deletePeriodSlot error:', error);
    return res.status(500).json({ message: 'Error deleting period slot' });
  }
};

const exportPeriodSlotsCsv = async (req, res) => {
  try {
    const { course, department, year, section } = req.query;
    const filter = {};
    if (section) filter.section = section;

    const slots = await PeriodSlot.find(filter)
      .populate({
        path: 'section',
        populate: { path: 'department', populate: { path: 'course', select: 'code' } },
      })
      .populate('subject', 'code')
      .populate('teacher', 'employeeId email')
      .populate('session', 'semesterLabel')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    let filtered = slots;
    if (department) {
      filtered = filtered.filter((s) => s.section?.department?.code === department || s.section?.department?._id?.toString() === department);
    }
    if (course) {
      filtered = filtered.filter((s) => s.section?.department?.course?.code === course || s.section?.department?.course?._id?.toString() === course);
    }

    if (req.user && req.user.role === 'hod') {
      const userYear = Number(req.user.year);
      const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
      filtered = filtered.filter((s) => {
        const sCourseId = s.section?.department?.course?._id?.toString() || s.section?.department?.course?.toString();
        return Number(s.section?.year) === userYear && (!userCourseId || sCourseId === userCourseId);
      });
    } else if (year) {
      filtered = filtered.filter((s) => Number(s.section?.year) === Number(year));
    }

    const rows = filtered.map((s) => ({
      courseCode: s.section?.department?.course?.code || '',
      departmentCode: s.section?.department?.code || '',
      year: s.section?.year || 1,
      sectionName: s.section?.name || '',
      dayOfWeek: INT_TO_DAY_NAME[s.dayOfWeek] || 'Mon',
      periodNumber: s.periodNumber,
      startTime: s.startTime,
      endTime: s.endTime,
      isRecess: s.isRecess ? 'TRUE' : 'FALSE',
      recessLabel: s.recessLabel || '',
      subjectCode: s.isRecess ? '' : (s.subject?.code || ''),
      teacherEmployeeId: s.isRecess ? '' : (s.teacher?.employeeId || s.teacher?.email || ''),
      sessionLabel: s.session?.semesterLabel || '',
    }));

    const csvData = toCsv(rows, [
      'courseCode',
      'departmentCode',
      'year',
      'sectionName',
      'dayOfWeek',
      'periodNumber',
      'startTime',
      'endTime',
      'isRecess',
      'recessLabel',
      'subjectCode',
      'teacherEmployeeId',
      'sessionLabel',
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="master_timetable.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportPeriodSlotsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting timetable CSV' });
  }
};

const exportTimetablePdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const section = req.query.section || req.query.sectionId;
    if (!section) {
      return res.status(400).json({ message: 'Section ID query parameter is required.' });
    }

    const sectionDoc = await Section.findById(section)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('session');

    if (!sectionDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    let templates = await PeriodTemplate.find({ section }).sort({ periodNumber: 1 });
    let periods = [];
    if (templates.length > 0) {
      periods = templates.map((t) => ({
        periodNumber: t.periodNumber,
        label: t.label || `Period ${t.periodNumber}`,
        startTime: t.startTime,
        endTime: t.endTime,
        isRecess: t.isRecess,
      }));
    } else {
      periods = [
        { periodNumber: 1, startTime: '09:00', endTime: '09:50', isRecess: false },
        { periodNumber: 2, startTime: '09:50', endTime: '10:40', isRecess: false },
        { periodNumber: 3, startTime: '10:40', endTime: '11:30', isRecess: false },
        { periodNumber: 4, startTime: '11:30', endTime: '12:10', isRecess: true },
        { periodNumber: 5, startTime: '12:10', endTime: '01:00', isRecess: false },
        { periodNumber: 6, startTime: '01:00', endTime: '01:50', isRecess: false },
        { periodNumber: 7, startTime: '01:50', endTime: '02:40', isRecess: false },
      ];
    }

    const slots = await PeriodSlot.find({ section })
      .populate('subject', 'name code')
      .populate('teacher', 'name email employeeId');

    const html = buildTimetablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      section: sectionDoc,
      course: sectionDoc.department?.course,
      department: sectionDoc.department,
      session: sectionDoc.session,
      periods,
      slots,
    });

    const pdfBuffer = await generatePdf(html, { landscape: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sectionDoc.name}_Weekly_Timetable.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportTimetablePdf error:', err);
    return res.status(500).json({ message: 'Error generating timetable PDF', error: err.message });
  }
};

const importPeriodSlotsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const [departments, sections, subjects, teachers, sessions] = await Promise.all([
      Department.find().populate('course'),
      Section.find().populate({ path: 'department', populate: { path: 'course' } }),
      Subject.find(),
      User.find({ role: { $in: ['teacher', 'hod'] } }),
      AcademicSession.find(),
    ]);

    const activeSession = sessions.find((s) => s.isActive) || sessions[0];
    const sessionMap = new Map();
    sessions.forEach((s) => sessionMap.set(s.semesterLabel.toLowerCase(), s._id));

    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d._id);
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d._id);
      }
    });

    const subjectMap = new Map();
    subjects.forEach((s) => subjectMap.set(s.code.toUpperCase(), s._id));

    const teacherMap = new Map();
    teachers.forEach((t) => {
      if (t.employeeId) teacherMap.set(t.employeeId.toUpperCase(), t._id);
      teacherMap.set(t.email.toLowerCase(), t._id);
    });

    // Pre-validation: verify that rows sharing the same section and periodNumber within the CSV do not have conflicting start/end times
    const csvTimingMap = new Map();
    const badKeys = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.department || '').toUpperCase().trim();
      const yr = Number(row.year || 1);
      const secName = (row.sectionName || row.section || '').toUpperCase().trim();
      const pNum = Number(row.periodNumber || row.period || 1);
      const sTime = (row.startTime || row.start || '').trim();
      const eTime = (row.endTime || row.end || '').trim();
      const key = `${courseCode}_${deptCode}_${yr}_${secName}_${pNum}`;

      if (sTime && eTime && pNum) {
        if (!csvTimingMap.has(key)) {
          csvTimingMap.set(key, { startTime: sTime, endTime: eTime, rowNum: i + 2, secName, pNum });
        } else {
          const existing = csvTimingMap.get(key);
          if (existing.startTime !== sTime || existing.endTime !== eTime) {
            badKeys.add(key);
            errors.push({
              row: i + 2,
              reason: `Timing Conflict: Period #${pNum} for section '${secName}' has mismatched times (${sTime}-${eTime}) compared to Row ${existing.rowNum} (${existing.startTime}-${existing.endTime}). All slots for Period #${pNum} in the same section must have identical start and end times.`,
            });
            skipped++;
          }
        }
      }
    }

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.department || '').toUpperCase().trim();
      const yr = Number(row.year || 1);
      const secName = (row.sectionName || row.section || '').toUpperCase().trim();
      const dayRaw = (row.dayOfWeek || row.day || 'Mon').toString().toLowerCase().trim();
      const pNum = Number(row.periodNumber || row.period || 1);
      const startTime = (row.startTime || row.start || '09:00').trim();
      const endTime = (row.endTime || row.end || '10:00').trim();
      const isRecessRaw = (row.isRecess || row.is_recess || '').toString().toLowerCase().trim();
      const isRecess = isRecessRaw === 'true' || isRecessRaw === '1' || isRecessRaw === 'yes';
      const recessLabel = (row.recessLabel || row.recess_label || (isRecess ? 'Recess' : '')).trim();
      const subCode = (row.subjectCode || row.subject || '').toUpperCase().trim();
      const teacherEmpId = (row.teacherEmployeeId || row.teacher || '').toUpperCase().trim();
      const sessionLabel = (row.sessionLabel || '').toLowerCase().trim();

      const key = `${courseCode}_${deptCode}_${yr}_${secName}_${pNum}`;
      if (badKeys.has(key)) {
        // Already flagged in pre-validation
        continue;
      }

      const dayInt = DAY_NAME_TO_INT[dayRaw] !== undefined ? DAY_NAME_TO_INT[dayRaw] : Number(dayRaw);
      if (isNaN(dayInt) || dayInt < 0 || dayInt > 6) {
        errors.push({ row: lineNum, reason: `Invalid day of week '${dayRaw}'. Use Mon, Tue, Wed, etc.` });
        skipped++;
        continue;
      }

      let deptId = null;
      if (courseCode) {
        deptId = deptCompoundMap.get(`${courseCode}_${deptCode}`);
      } else {
        deptId = deptCompoundMap.get(deptCode);
      }

      if (!deptId) {
        errors.push({
          row: lineNum,
          reason: courseCode
            ? `No department '${deptCode}' found under course '${courseCode}' -- check spelling or create it first.`
            : `Department code '${deptCode}' not found.`,
        });
        skipped++;
        continue;
      }

      // Course + Year HOD Verification for CSV Import
      if (req.user && req.user.role === 'hod') {
        const userYear = Number(req.user.year);
        const userCourseId = req.user.course?._id ? req.user.course._id.toString() : (req.user.course ? req.user.course.toString() : null);
        
        const targetDept = departments.find((d) => d._id.toString() === deptId.toString());
        const targetCourseId = targetDept?.course?._id?.toString() || targetDept?.course?.toString();

        if (yr !== userYear || (userCourseId && targetCourseId !== userCourseId)) {
          errors.push({
            row: lineNum,
            reason: `Access denied: Cannot import timetable outside your assigned course and year.`,
          });
          skipped++;
          continue;
        }
      }

      const secDoc = sections.find(
        (s) =>
          s.department?._id?.toString() === deptId.toString() &&
          s.name.toUpperCase() === secName
      );
      if (!secDoc) {
        errors.push({ row: lineNum, reason: `Section '${secName}' not found in department.` });
        skipped++;
        continue;
      }

      let subId = null;
      let teacherId = null;

      if (!isRecess) {
        if (!subCode || !teacherEmpId) {
          errors.push({ row: lineNum, reason: 'SubjectCode and TeacherEmployeeId are required for teaching periods.' });
          skipped++;
          continue;
        }

        subId = subjectMap.get(subCode);
        if (!subId) {
          errors.push({ row: lineNum, reason: `Subject code '${subCode}' not found.` });
          skipped++;
          continue;
        }

        teacherId = teacherMap.get(teacherEmpId) || teacherMap.get(teacherEmpId.toLowerCase());
        if (!teacherId) {
          errors.push({ row: lineNum, reason: `Teacher with Employee ID / Email '${teacherEmpId}' not found.` });
          skipped++;
          continue;
        }
      }

      const sessionId = sessionMap.get(sessionLabel) || (activeSession ? activeSession._id : null);
      if (!sessionId) {
        errors.push({ row: lineNum, reason: 'No active academic session found.' });
        skipped++;
        continue;
      }

      // Check Teacher double booking (skip for Recess)
      if (!isRecess && teacherId) {
        const conflict = await PeriodSlot.findOne({
          teacher: teacherId,
          dayOfWeek: dayInt,
          periodNumber: pNum,
          session: sessionId,
          section: { $ne: secDoc._id },
          isRecess: { $ne: true },
        })
          .populate('section', 'name')
          .populate('subject', 'name');

        if (conflict) {
          errors.push({
            row: lineNum,
            reason: `Teacher Collision: Teacher already booked for ${conflict.subject?.name || 'Class'} in section ${conflict.section?.name || 'another section'} on Period #${pNum} (${INT_TO_DAY_NAME[dayInt]}).`,
          });
          skipped++;
          continue;
        }
      }

      // Upsert PeriodTemplate
      await PeriodTemplate.findOneAndUpdate(
        { section: secDoc._id, periodNumber: pNum },
        { section: secDoc._id, periodNumber: pNum, startTime, endTime },
        { upsert: true }
      );

      let slot = await PeriodSlot.findOne({
        section: secDoc._id,
        dayOfWeek: dayInt,
        periodNumber: pNum,
        session: sessionId,
      });

      if (slot) {
        slot.startTime = startTime;
        slot.endTime = endTime;
        slot.subject = isRecess ? null : subId;
        slot.teacher = isRecess ? null : teacherId;
        slot.isRecess = isRecess;
        slot.recessLabel = isRecess ? recessLabel : '';
        await slot.save();
        updated++;
      } else {
        slot = new PeriodSlot({
          section: secDoc._id,
          dayOfWeek: dayInt,
          periodNumber: pNum,
          startTime,
          endTime,
          subject: isRecess ? null : subId,
          teacher: isRecess ? null : teacherId,
          session: sessionId,
          isRecess,
          recessLabel: isRecess ? recessLabel : '',
        });
        await slot.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importPeriodSlotsCsv error:', err);
    return res.status(500).json({ message: 'Error importing timetable CSV', error: err.message });
  }
};

// ==================== HOLIDAYS ====================
const createHoliday = async (req, res) => {
  try {
    const { date, name, session, scope, course, department } = req.body;
    if (!date || !name) {
      return res.status(400).json({ message: 'Date and holiday name are required.' });
    }

    const normDate = normalizeDate(date);
    const targetScope = ['all', 'course', 'department'].includes(scope) ? scope : 'all';

    let courseId = null;
    let departmentId = null;

    if (targetScope === 'course') {
      if (!course) {
        return res.status(400).json({ message: 'Course is required for course-scoped holiday.' });
      }
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (!courseDoc) {
        return res.status(400).json({ message: 'Course not found.' });
      }
      courseId = courseDoc._id;
    } else if (targetScope === 'department') {
      if (!department) {
        return res.status(400).json({ message: 'Department is required for department-scoped holiday.' });
      }
      const deptDoc = mongoose.Types.ObjectId.isValid(department)
        ? await Department.findById(department)
        : await Department.findOne({ code: department.toUpperCase().trim() });
      if (!deptDoc) {
        return res.status(400).json({ message: 'Department not found.' });
      }
      departmentId = deptDoc._id;
      courseId = deptDoc.course;
    }

    const conflictQuery = {
      date: normDate,
      scope: targetScope,
      course: courseId,
      department: departmentId,
    };

    const existing = await Holiday.findOne(conflictQuery);
    if (existing) {
      return res.status(409).json({ message: `A holiday is already recorded for this date and scope (${existing.name}).` });
    }

    const holiday = new Holiday({
      date: normDate,
      name: name.trim(),
      session: session || null,
      scope: targetScope,
      course: courseId,
      department: departmentId,
    });

    await holiday.save();
    const populated = await Holiday.findById(holiday._id)
      .populate('course', 'name code durationYears')
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } });
    return res.status(201).json(populated);
  } catch (err) {
    console.error('createHoliday error:', err);
    return res.status(500).json({ message: 'Error creating holiday', error: err.message });
  }
};

const getHolidays = async (req, res) => {
  try {
    const { month, scope, course, department } = req.query;
    const filter = {};

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      filter.date = { $gte: startDate, $lte: endDate };
    }

    if (scope) {
      filter.scope = scope;
    }

    if (course) {
      const courseDoc = mongoose.Types.ObjectId.isValid(course)
        ? await Course.findById(course)
        : await Course.findOne({ code: course.toUpperCase().trim() });
      if (courseDoc) {
        filter.$or = [
          { scope: 'all' },
          { scope: 'course', course: courseDoc._id },
          { scope: 'department', course: courseDoc._id },
        ];
      }
    }

    if (department) {
      const deptDoc = mongoose.Types.ObjectId.isValid(department)
        ? await Department.findById(department)
        : await Department.findOne({ code: department.toUpperCase().trim() });
      if (deptDoc) {
        filter.$or = [
          { scope: 'all' },
          { scope: 'course', course: deptDoc.course },
          { scope: 'department', department: deptDoc._id },
        ];
      }
    }

    const holidays = await Holiday.find(filter)
      .populate('course', 'name code durationYears')
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .sort({ date: 1 });
    return res.status(200).json(holidays);
  } catch (err) {
    console.error('getHolidays error:', err);
    return res.status(500).json({ message: 'Error fetching holidays' });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    await Holiday.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Holiday deleted successfully.' });
  } catch (err) {
    console.error('deleteHoliday error:', err);
    return res.status(500).json({ message: 'Error deleting holiday' });
  }
};

const exportHolidaysCsv = async (req, res) => {
  try {
    const holidays = await Holiday.find()
      .populate('course', 'code')
      .populate('department', 'code')
      .sort({ date: 1 });
    const rows = holidays.map((h) => ({
      date: h.date.toISOString().split('T')[0],
      name: h.name,
      scope: h.scope || 'all',
      courseCode: h.course?.code || '',
      departmentCode: h.department?.code || '',
    }));
    const csvData = toCsv(rows, ['date', 'name', 'scope', 'courseCode', 'departmentCode']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="holidays.csv"');
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportHolidaysCsv error:', err);
    return res.status(500).json({ message: 'Error exporting holidays CSV' });
  }
};

const exportHolidaysPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const holidays = await Holiday.find()
      .populate('course', 'code')
      .populate('department', 'code')
      .sort({ date: 1 });

    const rows = holidays.map((h) => {
      let scopeStr = 'All Campus';
      if (h.scope === 'course' && h.course) {
        scopeStr = `Course (${h.course.code})`;
      } else if (h.scope === 'department' && h.department) {
        scopeStr = `Dept (${h.department.code})`;
      }

      return {
        date: new Date(h.date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        name: h.name,
        scope: scopeStr,
      };
    });

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Institutional Holiday Calendar',
      subtitle: 'Official list of scheduled academic and national holidays',
      columns: [
        { header: 'Date', key: 'date', align: 'center' },
        { header: 'Holiday Name', key: 'name' },
        {
          header: 'Scope',
          render: (r) => `<span class="badge badge-purple">${r.scope}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="holidays.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHolidaysPdf error:', err);
    return res.status(500).json({ message: 'Error generating holidays PDF', error: err.message });
  }
};

const importHolidaysCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const courses = await Course.find();
    const courseMap = new Map();
    courses.forEach((c) => courseMap.set(c.code.toUpperCase(), c));

    const departments = await Department.find().populate('course');
    const deptCompoundMap = new Map();
    departments.forEach((d) => {
      const cCode = d.course?.code ? d.course.code.toUpperCase() : '';
      deptCompoundMap.set(`${cCode}_${d.code.toUpperCase()}`, d);
      if (!deptCompoundMap.has(d.code.toUpperCase())) {
        deptCompoundMap.set(d.code.toUpperCase(), d);
      }
    });

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const dateStr = (row.date || row.Date || '').trim();
      const name = (row.name || row.Name || '').trim();
      const scopeRaw = (row.scope || row.Scope || 'all').toLowerCase().trim();
      const courseCode = (row.courseCode || row.CourseCode || row.course || '').toUpperCase().trim();
      const deptCode = (row.departmentCode || row.DepartmentCode || row.department || '').toUpperCase().trim();

      if (!dateStr || !name) {
        errors.push({ row: lineNum, reason: 'Date (YYYY-MM-DD) and Name are required.' });
        skipped++;
        continue;
      }

      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        errors.push({ row: lineNum, reason: `Invalid date format '${dateStr}'.` });
        skipped++;
        continue;
      }

      const targetScope = ['all', 'course', 'department'].includes(scopeRaw) ? scopeRaw : 'all';
      let courseDoc = null;
      let deptDoc = null;

      if (targetScope === 'course') {
        if (!courseCode) {
          errors.push({ row: lineNum, reason: 'courseCode is required for course-scoped holiday.' });
          skipped++;
          continue;
        }
        courseDoc = courseMap.get(courseCode);
        if (!courseDoc) {
          errors.push({ row: lineNum, reason: `Course code '${courseCode}' not found.` });
          skipped++;
          continue;
        }
      } else if (targetScope === 'department') {
        if (!deptCode) {
          errors.push({ row: lineNum, reason: 'departmentCode is required for department-scoped holiday.' });
          skipped++;
          continue;
        }
        if (courseCode) {
          deptDoc = deptCompoundMap.get(`${courseCode}_${deptCode}`);
        } else {
          deptDoc = deptCompoundMap.get(deptCode);
        }
        if (!deptDoc) {
          errors.push({ row: lineNum, reason: `Department code '${deptCode}' not found.` });
          skipped++;
          continue;
        }
      }

      const normDate = normalizeDate(parsedDate);
      const query = {
        date: normDate,
        scope: targetScope,
        course: courseDoc ? courseDoc._id : (deptDoc ? deptDoc.course : null),
        department: deptDoc ? deptDoc._id : null,
      };

      let holiday = await Holiday.findOne(query);
      if (holiday) {
        holiday.name = name;
        await holiday.save();
        updated++;
      } else {
        holiday = new Holiday({
          date: normDate,
          name,
          scope: targetScope,
          course: query.course,
          department: query.department,
        });
        await holiday.save();
        created++;
      }
    }

    return res.status(200).json({
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('importHolidaysCsv error:', err);
    return res.status(500).json({ message: 'Error importing holidays', error: err.message });
  }
};

// ==================== SETTINGS & REPORTS ====================
const getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({
        editWindowHours: process.env.EDIT_WINDOW_HOURS ? Number(process.env.EDIT_WINDOW_HOURS) : 24,
        attendanceThresholdPercent: process.env.ATTENDANCE_THRESHOLD_PERCENT ? Number(process.env.ATTENDANCE_THRESHOLD_PERCENT) : 75,
        institutionName: 'AttendEdge Institute of Technology',
      });
    }
    return res.status(200).json(settings);
  } catch (error) {
    console.error('getSettings error:', error);
    return res.status(500).json({ message: 'Error fetching settings' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { editWindowHours, attendanceThresholdPercent, institutionName } = req.body;
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting();
    }

    if (editWindowHours !== undefined) settings.editWindowHours = Number(editWindowHours);
    if (attendanceThresholdPercent !== undefined) settings.attendanceThresholdPercent = Number(attendanceThresholdPercent);
    if (institutionName !== undefined) settings.institutionName = institutionName;

    await settings.save();
    return res.status(200).json(settings);
  } catch (error) {
    console.error('updateSettings error:', error);
    return res.status(500).json({ message: 'Error updating settings' });
  }
};

const getGlobalReports = async (req, res) => {
  try {
    const { year: filterYear, course: filterCourse } = req.query;

    let courseDeptIds = null;
    if (filterCourse) {
      const courseDoc = mongoose.Types.ObjectId.isValid(filterCourse)
        ? await Course.findById(filterCourse)
        : await Course.findOne({ code: filterCourse.toUpperCase().trim() });
      if (courseDoc) {
        const depts = await Department.find({ course: courseDoc._id }).select('_id');
        courseDeptIds = depts.map((d) => d._id.toString());
      }
    }

    const deptFilter = courseDeptIds ? { _id: { $in: courseDeptIds } } : {};
    const [
      totalStudents,
      totalTeachers,
      totalDepartments,
      departments,
      attendances,
      recentAttendances,
      settings,
      studentYearAgg,
    ] = await Promise.all([
      Student.countDocuments(courseDeptIds ? { department: { $in: courseDeptIds }, isActive: true } : { isActive: true }),
      User.countDocuments(courseDeptIds ? { department: { $in: courseDeptIds }, role: 'teacher', isActive: true } : { role: 'teacher', isActive: true }),
      Department.countDocuments(deptFilter),
      Department.find(deptFilter).populate('course', 'name code').sort({ name: 1 }),
      Attendance.find().populate('records.student', 'department year').populate('section', 'department year'),
      Attendance.find()
        .populate('teacher', 'name email')
        .populate('subject', 'name code')
        .populate('section', 'name year')
        .sort({ markedAt: -1 })
        .limit(10),
      Setting.findOne(),
      Student.aggregate([
        { $match: { isActive: true, ...(courseDeptIds ? { department: { $in: courseDeptIds.map((id) => new mongoose.Types.ObjectId(id)) } } : {}) } },
        {
          $group: {
            _id: {
              department: '$department',
              year: { $ifNull: ['$year', 1] },
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const matrixMap = {};
    departments.forEach((d) => {
      matrixMap[d._id.toString()] = {
        departmentId: d._id,
        name: d.name,
        code: d.course?.code ? `${d.code} (${d.course.code})` : d.code,
        year1: 0,
        year2: 0,
        year3: 0,
        year4: 0,
        total: 0,
      };
    });

    studentYearAgg.forEach((item) => {
      const deptId = item._id.department?.toString();
      const yr = item._id.year;
      const cnt = item.count;
      if (deptId && matrixMap[deptId]) {
        if (yr === 1) matrixMap[deptId].year1 += cnt;
        else if (yr === 2) matrixMap[deptId].year2 += cnt;
        else if (yr === 3) matrixMap[deptId].year3 += cnt;
        else if (yr === 4) matrixMap[deptId].year4 += cnt;
        matrixMap[deptId].total += cnt;
      }
    });

    const departmentYearMatrix = Object.values(matrixMap);

    let globalPresent = 0;
    let globalLate = 0;
    let globalAbsent = 0;

    const deptStats = {};
    departments.forEach((d) => {
      deptStats[d._id.toString()] = {
        name: d.name,
        code: d.course?.code ? `${d.code} (${d.course.code})` : d.code,
        present: 0,
        late: 0,
        absent: 0,
        totalPeriodsMarked: 0,
      };
    });

    const trendMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendMap.set(key, { date: key, present: 0, absent: 0, late: 0, percentage: 0 });
    }

    attendances.forEach((att) => {
      if (filterYear && att.section?.year && Number(att.section.year) !== Number(filterYear)) {
        return;
      }

      const deptId = att.section?.department?.toString();
      if (courseDeptIds && (!deptId || !courseDeptIds.includes(deptId))) {
        return;
      }

      const dateKey = att.date.toISOString().split('T')[0];

      let p = 0, l = 0, a = 0;
      att.records.forEach((r) => {
        if (r.status === 'present') { p++; globalPresent++; }
        else if (r.status === 'late') { l++; globalLate++; }
        else if (r.status === 'absent') { a++; globalAbsent++; }
      });

      if (deptId && deptStats[deptId]) {
        deptStats[deptId].present += p;
        deptStats[deptId].late += l;
        deptStats[deptId].absent += a;
        deptStats[deptId].totalPeriodsMarked += 1;
      }

      if (trendMap.has(dateKey)) {
        const item = trendMap.get(dateKey);
        item.present += p;
        item.late += l;
        item.absent += a;
      }
    });

    const attendanceTrend = Array.from(trendMap.values()).map((item) => ({
      ...item,
      percentage: calculateAttendancePercentage(item.present, item.late, item.absent),
    }));

    const departmentComparison = Object.values(deptStats).map((d) => ({
      name: d.name,
      code: d.code,
      present: d.present,
      late: d.late,
      absent: d.absent,
      totalPeriods: d.totalPeriodsMarked,
      attendancePercentage: calculateAttendancePercentage(d.present, d.late, d.absent),
    }));

    const globalAttendancePercentage = calculateAttendancePercentage(globalPresent, globalLate, globalAbsent);

    return res.status(200).json({
      summary: {
        totalStudents,
        totalTeachers,
        totalDepartments,
        globalAttendancePercentage,
        totalSessionsConducted: attendances.length,
        globalPresent,
        globalLate,
        globalAbsent,
        thresholdPercent: settings?.attendanceThresholdPercent || 75,
      },
      attendanceTrend,
      departmentComparison,
      departmentYearMatrix,
      recentActivity: recentAttendances,
    });
  } catch (error) {
    console.error('getGlobalReports error:', error);
    return res.status(500).json({ message: 'Error generating global reports', error: error.message });
  }
};

const exportReportsPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    const { department } = req.query;
    const depts = await Department.find(department ? { _id: department } : {}).populate('course');
    const rows = [];

    for (const d of depts) {
      const studentCount = await Student.countDocuments({ department: d._id, isActive: true });
      const sectionCount = await Section.countDocuments({ department: d._id });
      rows.push({
        deptName: d.name,
        code: d.code,
        course: d.course?.code || '—',
        students: studentCount,
        sections: sectionCount,
      });
    }

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || 'AttendEdge Institute of Technology',
      title: 'Consolidated Academic & Department Analytics Report',
      subtitle: 'Overview of department enrollment, sections, and program distribution',
      columns: [
        { header: 'Department Name', key: 'deptName' },
        { header: 'Code', key: 'code', align: 'center' },
        { header: 'Program', key: 'course', align: 'center' },
        { header: 'Active Students', key: 'students', align: 'center' },
        { header: 'Sections', key: 'sections', align: 'center' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="academic_analytics_report.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportReportsPdf error:', err);
    return res.status(500).json({ message: 'Error generating reports PDF', error: err.message });
  }
};

const getAdminDefaulters = async (req, res) => {
  try {
    const { month, startDate, endDate, department, course, year, subject, mode, batch, batchId } = req.query;

    const data = await calculateDefaulters({
      month,
      startDate,
      endDate,
      courseId: course || null,
      departmentId: department || null,
      year: year ? Number(year) : null,
      subjectId: subject || null,
      batchId: batchId || batch || null,
      mode: mode || (subject ? 'subject' : 'overall'),
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('getAdminDefaulters error:', error);
    return res.status(500).json({ message: error.message || 'Error calculating defaulters' });
  }
};

const exportDefaultersPdf = async (req, res) => {
  try {
    const settings = await Setting.findOne();
    let { month, startDate, endDate, department, course, year, subject, mode, batch, batchId } = req.query;

    const data = await calculateDefaulters({
      month,
      startDate,
      endDate,
      courseId: course || null,
      departmentId: department || null,
      year: year ? Number(year) : null,
      subjectId: subject || null,
      batchId: batchId || batch || null,
      mode: mode || (subject ? 'subject' : 'overall'),
    });

    let batchLabel = '';
    if (batch || batchId) {
      const bDoc = await Batch.findById(batchId || batch);
      if (bDoc) batchLabel = bDoc.name;
    }

    const rows = (data.defaulters || []).map((d) => ({
      rollNumber: d.rollNumber || 'N/A',
      name: d.name || 'N/A',
      courseDept: d.courseDept || (d.courseCode && d.departmentCode ? `${d.courseCode} · ${d.departmentCode}` : d.departmentName || d.department || 'N/A'),
      batch: d.batchName || batchLabel || '—',
      section: d.section || d.sectionName || 'N/A',
      year: d.year ? `Year ${d.year}` : 'N/A',
      attended: `${d.present != null ? d.present : (d.attended != null ? d.attended : 'N/A')} / ${d.totalPeriods != null ? d.totalPeriods : 'N/A'}`,
      percentage: `${d.percentage != null && !isNaN(d.percentage) ? d.percentage : 'N/A'}%`,
    }));

    const dateFilterLabel = data.rangeLabel || (data.startDate && data.endDate ? `${data.startDate} to ${data.endDate}` : data.month || 'Current Period');

    const html = buildGenericTablePdfHtml({
      institutionName: settings?.institutionName || settings?.collegeName || 'Everest College',
      title: `Attendance Defaulters Report · ${dateFilterLabel}`,
      subtitle: `Students falling below mandatory attendance threshold (${data.thresholdPercent || 75}%)`,
      filters: {
        'Date Range': dateFilterLabel,
        ...(batchLabel ? { Batch: batchLabel } : {}),
        Mode: data.mode === 'subject' ? 'Subject-wise' : 'Overall',
        Threshold: `${data.thresholdPercent || 75}%`,
      },
      columns: [
        { header: 'Roll No', key: 'rollNumber', align: 'center' },
        { header: 'Student Name', key: 'name' },
        { header: 'Program / Dept', key: 'courseDept', align: 'center' },
        { header: 'Cohort Batch', key: 'batch', align: 'center' },
        { header: 'Section', key: 'section', align: 'center' },
        { header: 'Year', key: 'year', align: 'center' },
        { header: 'Attended / Total', key: 'attended', align: 'center' },
        {
          header: 'Attendance %',
          render: (r) => `<span class="badge badge-rose"><strong>${r.percentage}</strong></span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="defaulters_report.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportDefaultersPdf error:', err);
    return res.status(500).json({ message: 'Error generating defaulters PDF', error: err.message });
  }
};

module.exports = {
  createCourse,
  getCourses,
  updateCourse,
  deleteCourse,
  exportCoursesCsv,
  exportCoursesPdf,
  importCoursesCsv,
  createDepartment,
  getDepartments,
  updateDepartment,
  deleteDepartment,
  exportDepartmentsCsv,
  exportDepartmentsPdf,
  importDepartmentsCsv,
  createBatch,
  getBatches,
  updateBatch,
  deleteBatch,
  exportBatchesCsv,
  exportBatchesPdf,
  importBatchesCsv,
  createUser,
  getUsers,
  updateUser,
  deleteUser,
  exportUsersCsv,
  exportUsersPdf,
  importUsersCsv,
  createSession,
  getSessions,
  updateSession,
  deleteSession,
  createSection,
  getSections,
  updateSection,
  deleteSection,
  exportSectionsCsv,
  exportSectionsPdf,
  importSectionsCsv,
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  forceDeleteSubject,
  archiveSubject,
  restoreSubject,
  exportSubjectsCsv,
  exportSubjectsPdf,
  importSubjectsCsv,
  createStudent,
  getStudents,
  updateStudent,
  deleteStudent,
  bulkImportStudents,
  detectDuplicateStudents,
  resolveDuplicateStudents,
  exportStudentsCsv,
  exportStudentsPdf,
  backfillMissingYears,
  backfillMissingSectionBatches,
  createPeriodSlot,
  updatePeriodSlot,
  getPeriodSlots,
  deletePeriodSlot,
  exportPeriodSlotsCsv,
  exportTimetablePdf,
  importPeriodSlotsCsv,
  createHoliday,
  getHolidays,
  deleteHoliday,
  exportHolidaysCsv,
  exportHolidaysPdf,
  importHolidaysCsv,
  getSettings,
  updateSettings,
  getGlobalReports,
  exportReportsPdf,
  getAdminDefaulters,
  exportDefaultersPdf,
  getTeachersForCourse,
  getPeriodTemplates,
  updatePeriodTemplate,
  deletePeriodTemplate,
  getPeriodTimingInconsistencies,
  resolvePeriodTimingInconsistency,
};
