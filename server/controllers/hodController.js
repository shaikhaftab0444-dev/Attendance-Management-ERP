const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Section = require('../models/Section');
const TeacherSubject = require('../models/TeacherSubject');
const Student = require('../models/Student');
const PeriodSlot = require('../models/PeriodSlot');
const Attendance = require('../models/Attendance');
const Department = require('../models/Department');
const Setting = require('../models/Setting');
const PeriodTemplate = require('../models/PeriodTemplate');
const AcademicSession = require('../models/AcademicSession');
const Batch = require('../models/Batch');
const { calculateAttendancePercentage } = require('../utils/helpers');
const { calculateDefaulters } = require('../utils/defaulterAggregation');
const { generatePdf } = require('../utils/pdf');
const { buildGenericTablePdfHtml, buildTimetablePdfHtml } = require('../utils/pdfTemplate');
const { toCsv, parseCsv } = require('../utils/csv');

// Indian phone validation (+91 followed by 10 digits starting with 6-9)
const INDIAN_PHONE_REGEX = /^\+91[6-9]\d{9}$/;

function validateIndianPhone(phone) {
  if (!phone || phone.trim() === '') return true;
  return INDIAN_PHONE_REGEX.test(phone.trim());
}

// Helper to ensure HOD has managed Batch(es) assigned and retrieve associated Course departments and sections
const getHodScope = async (req) => {
  const user = req.user;
  if (!user) {
    throw new Error('Authentication required');
  }

  // Strictly extract batches assigned to this HOD
  let rawBatches = user.assignedBatches || user.batches || user.batch || [];
  if (!Array.isArray(rawBatches)) {
    rawBatches = [rawBatches];
  }

  const batchIds = rawBatches
    .map((b) => (b && typeof b === 'object' && b._id ? b._id.toString() : b ? b.toString() : ''))
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  // If HOD has no assigned batches, return an empty scope that blocks access to any data
  if (batchIds.length === 0) {
    return {
      batchIds: [],
      authorizedBatchIds: [],
      courseIds: [],
      allCourseIds: [],
      courseDepartments: [],
      courseDeptIds: [],
      sectionIds: [],
      year: user.year || 1,
    };
  }

  const managedBatches = await Batch.find({ _id: { $in: batchIds } }).populate('course');
  const authorizedBatchIds = managedBatches.map((b) => b._id);
  const courseIds = Array.from(
    new Set(managedBatches.map((b) => (b.course?._id || b.course)?.toString()).filter(Boolean))
  );

  const courseDepartments = await Department.find({ course: { $in: courseIds } })
    .populate('course', 'name code durationYears')
    .sort({ name: 1 });
  const courseDeptIds = courseDepartments.map((d) => d._id);

  const sections = await Section.find({ batch: { $in: authorizedBatchIds } }).select('_id department batch semester year');
  const sectionIds = sections.map((s) => s._id);

  return {
    batchIds: authorizedBatchIds,
    authorizedBatchIds,
    courseIds,
    allCourseIds: courseIds,
    courseDepartments,
    courseDeptIds,
    sectionIds,
    year: user.year || 1,
  };
};

// Helper to sanitize department filter against HOD's allowed course departments
const resolveDeptFilter = (deptQuery, courseDeptIds) => {
  if (!deptQuery || deptQuery === 'all') {
    return { $in: courseDeptIds };
  }
  const isAllowed = courseDeptIds.some((id) => id.toString() === deptQuery.toString());
  if (isAllowed) {
    return deptQuery;
  }
  // Foreign department requested - block access by matching nothing
  return { $in: [] };
};

// GET /api/hod/teacher-directory (Teacher list filtered to HOD's course/batches)
const getTeacherDirectory = async (req, res) => {
  try {
    const { courseDeptIds, batchIds } = await getHodScope(req);
    const teachers = await User.find({
      role: { $in: ['teacher', 'hod'] },
      isActive: true,
      $or: [
        { department: { $in: courseDeptIds } },
        { assignedBatches: { $in: batchIds } },
        { batches: { $in: batchIds } },
      ],
    })
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .populate('batches', 'name startYear endYear course isActive')
      .select('name email employeeId phone department role year course assignedBatches batches')
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error('getTeacherDirectory error:', error);
    return res.status(500).json({ message: 'Error fetching teacher directory' });
  }
};

// GET /api/hod/teachers (Faculty mapped to HOD's batches, sections, or departments)
const getDepartmentTeachers = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, sectionIds } = await getHodScope(req);
    const { department } = req.query;

    const assignedTeacherIds = await TeacherSubject.find({ section: { $in: sectionIds } }).distinct('teacher');
    const slotTeacherIds = await PeriodSlot.find({ section: { $in: sectionIds }, isRecess: { $ne: true } }).distinct('teacher');
    const validAssignedIds = assignedTeacherIds.filter(Boolean).map((id) => id.toString());
    const validSlotIds = slotTeacherIds.filter(Boolean).map((id) => id.toString());
    const allTeacherIds = Array.from(new Set([...validAssignedIds, ...validSlotIds]));

    const targetDept = resolveDeptFilter(department, courseDeptIds);

    const teachers = await User.find({
      role: 'teacher',
      $or: [
        { _id: { $in: allTeacherIds } },
        { assignedBatches: { $in: batchIds } },
        { batches: { $in: batchIds } },
        { department: targetDept },
      ],
      isActive: true,
    })
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .populate('batches', 'name startYear endYear course isActive')
      .select('-passwordHash')
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error('getDepartmentTeachers error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching faculty' });
  }
};

// POST /api/hod/staff or /api/hod/teachers (Create Teacher strictly scoped to HOD's course & department)
const createStaff = async (req, res) => {
  try {
    const { year, courseId, courseDeptIds } = await getHodScope(req);
    const { name, email, password, department, employeeId, phone, assignedBatches } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: `User with email '${cleanEmail}' already exists.` });
    }

    let targetDeptId = department;
    if (targetDeptId) {
      const isAllowed = courseDeptIds.some((id) => id.toString() === targetDeptId.toString());
      if (!isAllowed) {
        return res.status(403).json({ message: 'Selected department does not belong to your assigned course.' });
      }
    } else {
      targetDeptId = courseDeptIds[0];
    }

    if (phone && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    // Validate assignedBatches against HOD course
    let batchIds = [];
    if (Array.isArray(assignedBatches)) {
      const validBatches = await Batch.find({
        _id: { $in: assignedBatches.filter((b) => mongoose.Types.ObjectId.isValid(b)) },
        course: courseId,
      });
      batchIds = validBatches.map((b) => b._id);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const teacher = new User({
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'teacher',
      department: targetDeptId,
      course: null,
      year: null,
      teachingYears: [year],
      assignedBatches: batchIds,
      employeeId: employeeId ? employeeId.trim() : '',
      phone: phone ? phone.trim() : '',
      isActive: true,
    });

    await teacher.save();

    if (batchIds.length > 0) {
      await Batch.updateMany(
        { _id: { $in: batchIds } },
        { $addToSet: { assignedTeachers: teacher._id } }
      );
    }

    const populated = await User.findById(teacher._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .select('-passwordHash');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createStaff error:', error);
    return res.status(500).json({ message: error.message || 'Error creating teacher account' });
  }
};

// PATCH /api/hod/staff/:id or /api/hod/teachers/:id (Update Teacher strictly scoped to HOD's course)
const updateStaff = async (req, res) => {
  try {
    const { year, courseId, courseDeptIds } = await getHodScope(req);
    const { id } = req.params;
    const { name, email, password, department, employeeId, phone, isActive, assignedBatches } = req.body;

    const teacher = await User.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (teacher.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied. HODs can only manage Teacher accounts.' });
    }

    // Verify teacher belongs to HOD course departments
    const teacherDeptId = teacher.department?._id?.toString() || teacher.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === teacherDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Teacher does not belong to your assigned Course.' });
    }

    if (department) {
      const isAllowed = courseDeptIds.some((dId) => dId.toString() === department.toString());
      if (!isAllowed) {
        return res.status(403).json({ message: 'Selected department does not belong to your assigned course.' });
      }
      teacher.department = department;
    }

    if (phone !== undefined && phone !== '' && !validateIndianPhone(phone)) {
      return res.status(400).json({ message: 'Invalid phone number. Must be a valid 10-digit Indian mobile number (+91XXXXXXXXXX) starting with 6-9.' });
    }

    if (name) teacher.name = name.trim();
    if (email) teacher.email = email.toLowerCase().trim();
    if (employeeId !== undefined) teacher.employeeId = employeeId.trim();
    if (phone !== undefined) teacher.phone = phone ? phone.trim() : '';
    if (isActive !== undefined) teacher.isActive = isActive;

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      teacher.passwordHash = await bcrypt.hash(password, salt);
    }

    if (assignedBatches !== undefined) {
      let batchIds = [];
      if (Array.isArray(assignedBatches)) {
        const validBatches = await Batch.find({
          _id: { $in: assignedBatches.filter((b) => mongoose.Types.ObjectId.isValid(b)) },
          course: courseId,
        });
        batchIds = validBatches.map((b) => b._id);
      }
      teacher.assignedBatches = batchIds;

      await Batch.updateMany(
        { assignedTeachers: id, course: courseId, _id: { $nin: batchIds } },
        { $pull: { assignedTeachers: id } }
      );
      if (batchIds.length > 0) {
        await Batch.updateMany(
          { _id: { $in: batchIds } },
          { $addToSet: { assignedTeachers: id } }
        );
      }
    }

    // Ensure HOD's year is preserved in teachingYears
    const currentYears = Array.isArray(teacher.teachingYears) ? teacher.teachingYears : [];
    if (!currentYears.includes(year)) {
      teacher.teachingYears = [...currentYears, year].sort((a, b) => a - b);
    }

    await teacher.save();

    const populated = await User.findById(id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('assignedBatches', 'name startYear endYear course isActive')
      .select('-passwordHash');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateStaff error:', error);
    return res.status(500).json({ message: error.message || 'Error updating teacher account' });
  }
};

// DELETE /api/hod/staff/:id or /api/hod/teachers/:id
const deleteStaff = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { id } = req.params;

    const teacher = await User.findById(id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }

    if (teacher.role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied. HODs can only delete Teacher accounts.' });
    }

    const teacherDeptId = teacher.department?._id?.toString() || teacher.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === teacherDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Teacher does not belong to your assigned Course.' });
    }

    const [tsCount, slotCount, attCount] = await Promise.all([
      TeacherSubject.countDocuments({ teacher: id }),
      PeriodSlot.countDocuments({ teacher: id }),
      Attendance.countDocuments({ teacher: id }),
    ]);

    const total = tsCount + slotCount + attCount;
    if (total > 0) {
      teacher.isActive = false;
      await teacher.save();
      return res.status(200).json({
        message: `Teacher '${teacher.name}' has ${total} linked allocation/attendance records. Account has been deactivated instead of permanently deleted.`,
        deactivated: true,
      });
    }

    await User.findByIdAndDelete(id);
    await Batch.updateMany({ assignedTeachers: id }, { $pull: { assignedTeachers: id } });

    return res.status(200).json({ message: `Teacher '${teacher.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteStaff error:', error);
    return res.status(500).json({ message: error.message || 'Error deleting teacher' });
  }
};

// GET /api/hod/departments (Only departments belonging to HOD's own course)
const getDepartments = async (req, res) => {
  try {
    const { courseDepartments } = await getHodScope(req);
    return res.status(200).json(courseDepartments);
  } catch (error) {
    console.error('getDepartments error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching departments' });
  }
};

// GET /api/hod/batches (Batches managed by this HOD)
const getBatches = async (req, res) => {
  try {
    const { batchIds } = await getHodScope(req);
    const filter = {
      _id: { $in: batchIds },
    };
    if (req.query.isActive !== undefined && req.query.isActive !== 'all') {
      filter.isActive = req.query.isActive === 'true';
    }
    const batches = await Batch.find(filter)
      .populate('course', 'name code durationYears')
      .populate('assignedTeachers', 'name email')
      .sort({ startYear: -1, name: 1 });
    return res.status(200).json(batches);
  } catch (error) {
    console.error('getBatches error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching batches' });
  }
};

// GET /api/hod/subjects (Subjects strictly scoped to HOD's assigned batches)
const getDepartmentSubjects = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const { department, semester, isActive, includeArchived, batch } = req.query;

    const subFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };

    if (semester && semester !== 'all') subFilter.semester = Number(semester);
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      subFilter.batch = isAllowed ? batch : { $in: [] };
    }

    if (includeArchived === 'true' || isActive === 'all') {
      // no isActive filter
    } else if (isActive === 'false' || isActive === 'archived') {
      subFilter.isActive = false;
    } else if (isActive === 'true' || isActive === 'active') {
      subFilter.isActive = { $ne: false };
    } else {
      subFilter.isActive = { $ne: false };
    }

    const subjects = await Subject.find(subFilter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('batch', 'name startYear endYear isActive')
      .sort({ semester: 1, code: 1 });

    return res.status(200).json(subjects);
  } catch (error) {
    console.error('getDepartmentSubjects error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching subjects' });
  }
};

// POST /api/hod/subjects (Create Subject strictly scoped to HOD's assigned batch & department)
const createSubject = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, year } = await getHodScope(req);
    const { name, code, department, semester, credits, teacher, batch } = req.body;

    if (!name || !code || !semester) {
      return res.status(400).json({ message: 'Subject Name, Code, and Semester Level are required.' });
    }

    let assignedDept = department;
    if (assignedDept) {
      const isAllowed = courseDeptIds.some((id) => id.toString() === assignedDept.toString());
      if (!isAllowed) {
        return res.status(403).json({ message: 'Selected department does not belong to your assigned course.' });
      }
    } else {
      assignedDept = courseDeptIds[0];
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Subject.findOne({ code: cleanCode, department: assignedDept });
    if (existing) {
      return res.status(409).json({ message: `Subject code '${cleanCode}' already exists in this department.` });
    }

    let batchId = null;
    if (batch && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      if (isAllowed) {
        batchId = batch;
      }
    }
    if (!batchId && batchIds.length > 0) {
      batchId = batchIds[0];
    }

    const subject = new Subject({
      name: name.trim(),
      code: cleanCode,
      department: assignedDept,
      semester: Number(semester),
      year,
      credits: credits ? Number(credits) : 3,
      batch: batchId,
      isActive: true,
    });

    await subject.save();

    let assignedSectionsCount = 0;
    let assignedTeacherDoc = null;

    if (teacher) {
      const teacherDoc = await User.findOne({ _id: teacher, role: { $in: ['teacher', 'hod'] }, isActive: true });
      if (teacherDoc) {
        assignedTeacherDoc = teacherDoc;
        const activeSession = await AcademicSession.findOne({ isActive: true });
        const matchingSections = await Section.find({
          department: assignedDept,
          batch: batchId,
          semester: Number(semester),
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
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('batch', 'name startYear endYear isActive');

    const result = populated.toObject();
    result.assignedSectionsCount = assignedSectionsCount;
    result.assignedTeacher = assignedTeacherDoc
      ? { _id: assignedTeacherDoc._id, name: assignedTeacherDoc.name, email: assignedTeacherDoc.email }
      : null;

    return res.status(201).json(result);
  } catch (error) {
    console.error('createSubject error:', error);
    return res.status(500).json({ message: error.message || 'Error creating subject' });
  }
};

// PATCH /api/hod/subjects/:id (Update Subject strictly scoped to HOD's batches & course)
const updateSubject = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const { id } = req.params;
    const { name, code, department, semester, credits, teacher, batch, isActive } = req.body;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const subDeptId = subject.department?._id?.toString() || subject.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === subDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Subject does not belong to your course program.' });
    }

    if (name) subject.name = name.trim();
    if (code) subject.code = code.toUpperCase().trim();
    if (department) {
      const isAllowed = courseDeptIds.some((dId) => dId.toString() === department.toString());
      if (!isAllowed) {
        return res.status(403).json({ message: 'Selected department does not belong to your assigned course.' });
      }
      subject.department = department;
    }
    if (semester !== undefined) subject.semester = Number(semester);
    if (credits !== undefined) subject.credits = Number(credits);
    if (isActive !== undefined) subject.isActive = isActive;
    if (batch !== undefined) {
      if (batch && mongoose.Types.ObjectId.isValid(batch)) {
        const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
        if (isAllowed) {
          subject.batch = batch;
        } else {
          return res.status(403).json({ message: 'Selected batch is outside your assigned managed batches.' });
        }
      } else {
        subject.batch = null;
      }
    }

    await subject.save();

    let assignedSectionsCount = 0;
    let assignedTeacherDoc = null;

    if (teacher) {
      const teacherDoc = await User.findOne({ _id: teacher, role: { $in: ['teacher', 'hod'] }, isActive: true });
      if (teacherDoc) {
        assignedTeacherDoc = teacherDoc;
        const activeSession = await AcademicSession.findOne({ isActive: true });
        const matchingSections = await Section.find({
          department: subject.department,
          batch: subject.batch || { $in: batchIds },
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
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('batch', 'name startYear endYear isActive');

    const result = populated.toObject();
    result.assignedSectionsCount = assignedSectionsCount;
    result.assignedTeacher = assignedTeacherDoc
      ? { _id: assignedTeacherDoc._id, name: assignedTeacherDoc.name, email: assignedTeacherDoc.email }
      : null;

    return res.status(200).json(result);
  } catch (error) {
    console.error('updateSubject error:', error);
    return res.status(500).json({ message: error.message || 'Error updating subject' });
  }
};

// PATCH /api/hod/subjects/:id/archive
const archiveSubject = async (req, res) => {
  try {
    const { courseDeptIds } = await getHodScope(req);
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const subDeptId = subject.department?._id?.toString() || subject.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === subDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Subject does not belong to your course departments.' });
    }

    subject.isActive = false;
    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json({
      message: `Subject '${subject.name}' (${subject.code}) has been archived successfully.`,
      subject: populated,
    });
  } catch (error) {
    console.error('archiveSubject error:', error);
    return res.status(500).json({ message: error.message || 'Error archiving subject' });
  }
};

// PATCH /api/hod/subjects/:id/restore
const restoreSubject = async (req, res) => {
  try {
    const { courseDeptIds } = await getHodScope(req);
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const subDeptId = subject.department?._id?.toString() || subject.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === subDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Subject does not belong to your course departments.' });
    }

    subject.isActive = true;
    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code durationYears' } })
      .populate('batch', 'name startYear endYear isActive');

    return res.status(200).json({
      message: `Subject '${subject.name}' (${subject.code}) has been restored successfully.`,
      subject: populated,
    });
  } catch (error) {
    console.error('restoreSubject error:', error);
    return res.status(500).json({ message: error.message || 'Error restoring subject' });
  }
};

// DELETE /api/hod/subjects/:id (Safe delete with dependency check)
const deleteSubject = async (req, res) => {
  try {
    const { courseDeptIds } = await getHodScope(req);
    const { id } = req.params;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const subDeptId = subject.department?._id?.toString() || subject.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === subDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({ message: 'Access denied. Subject does not belong to your course program.' });
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
        message: `Cannot delete Subject '${subject.name}' (${subject.code}) -- it still has ${parts.join(', ')} associated with it. Reassign, archive, or use Force Delete.`,
        conflict: true,
        stats: { tsCount, slotCount, attCount },
      });
    }

    await Subject.findByIdAndDelete(id);
    return res.status(200).json({ message: `Subject '${subject.name}' deleted successfully.` });
  } catch (error) {
    console.error('deleteSubject error:', error);
    return res.status(500).json({ message: error.message || 'Error deleting subject' });
  }
};

// DELETE /api/hod/subjects/:id/force (Permanent cascade delete scoped to HOD)
const forceDeleteSubject = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { courseDeptIds } = await getHodScope(req);
    const { id } = req.params;

    const subject = await Subject.findById(id).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Subject not found.' });
    }

    const subDeptId = subject.department?._id?.toString() || subject.department?.toString();
    const isDeptInCourse = courseDeptIds.some((dId) => dId.toString() === subDeptId);
    if (!isDeptInCourse) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Access denied. Subject does not belong to your course program.' });
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
      message: `Subject '${subject.name}' (${subject.code}) and all associated records (${tsResult.deletedCount} allocations, ${slotResult.deletedCount} timetable slots, ${attResult.deletedCount} attendance records) have been permanently deleted.`,
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
    return res.status(500).json({ message: error.message || 'Error executing force delete' });
  }
};

// DELETE /api/hod/teacher-subjects/:id (Delete TeacherSubject Assignment scoped to HOD)
const deleteTeacherSubjectAssignment = async (req, res) => {
  try {
    const { batchIds, sectionIds } = await getHodScope(req);
    const { id } = req.params;

    const assignment = await TeacherSubject.findById(id).populate('section');
    if (!assignment) {
      return res.status(404).json({ message: 'Subject assignment not found.' });
    }

    const isAuthorized = sectionIds.some((sId) => sId.toString() === assignment.section?._id?.toString()) ||
      (assignment.section?.batch && batchIds.some((bId) => bId.toString() === assignment.section.batch.toString()));
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Access denied. Assignment does not belong to your managed Batches.' });
    }

    await TeacherSubject.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Teacher allocation removed successfully.' });
  } catch (error) {
    console.error('deleteTeacherSubjectAssignment error:', error);
    return res.status(500).json({ message: error.message || 'Error deleting teacher allocation' });
  }
};

// PATCH /api/hod/teacher-subjects/:id (Update TeacherSubject Assignment scoped to HOD)
const updateTeacherSubjectAssignment = async (req, res) => {
  try {
    const { batchIds, sectionIds, courseDeptIds } = await getHodScope(req);
    const { id } = req.params;
    const { teacher, subject, section, session } = req.body;

    const assignment = await TeacherSubject.findById(id).populate('section');
    if (!assignment) {
      return res.status(404).json({ message: 'Subject assignment not found.' });
    }

    const isAuthorized = sectionIds.some((sId) => sId.toString() === assignment.section?._id?.toString()) ||
      (assignment.section?.batch && batchIds.some((bId) => bId.toString() === assignment.section.batch.toString()));
    if (!isAuthorized) {
      return res.status(403).json({ message: 'Access denied. Assignment does not belong to your managed Batches.' });
    }

    if (teacher) {
      const validTeacher = await User.findOne({ _id: teacher, role: { $in: ['teacher', 'hod'] }, isActive: true });
      if (!validTeacher) {
        return res.status(400).json({ message: 'Selected teacher not found or is inactive.' });
      }
      assignment.teacher = teacher;
    }

    if (subject) {
      const validSubject = await Subject.findById(subject);
      if (!validSubject) {
        return res.status(400).json({ message: 'Selected subject not found.' });
      }
      assignment.subject = subject;
    }

    if (section) {
      const validSection = await Section.findById(section);
      if (!validSection) {
        return res.status(400).json({ message: 'Selected section not found.' });
      }
      const isSecAuthorized = sectionIds.some((sId) => sId.toString() === validSection._id.toString()) ||
        (validSection.batch && batchIds.some((bId) => bId.toString() === validSection.batch.toString()));
      if (!isSecAuthorized) {
        return res.status(403).json({ message: 'Selected section is outside your managed Batches.' });
      }
      assignment.section = section;
    }

    if (session) {
      assignment.session = session;
    }

    await assignment.save();

    const populated = await TeacherSubject.findById(assignment._id)
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate({
        path: 'subject',
        select: 'name code semester credits department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear isActive' },
        ],
      })
      .populate({
        path: 'section',
        select: 'name semester year department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear isActive' },
        ],
      })
      .populate('session', 'year semesterLabel isActive');

    return res.status(200).json(populated);
  } catch (error) {
    console.error('updateTeacherSubjectAssignment error:', error);
    return res.status(500).json({ message: error.message || 'Error updating teacher allocation' });
  }
};

// GET /api/hod/sections (All sections in HOD managed batches)
const getDepartmentSections = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const { department, session, batch } = req.query;

    const filter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (session) filter.session = session;
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      filter.batch = isAllowed ? batch : { $in: [] };
    }

    const sections = await Section.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('session', 'year semesterLabel isActive')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ department: 1, semester: 1, name: 1 });

    return res.status(200).json(sections);
  } catch (error) {
    console.error('getDepartmentSections error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching sections' });
  }
};

// GET /api/hod/teacher-subjects (Teacher assignments for sections in HOD managed batches)
const getTeacherSubjectAssignments = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const { department, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const sections = await Section.find(secFilter).select('_id');
    const sectionIds = sections.map((s) => s._id);

    const assignments = await TeacherSubject.find({ section: { $in: sectionIds } })
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate({
        path: 'subject',
        select: 'name code semester credits department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear isActive' },
        ],
      })
      .populate({
        path: 'section',
        select: 'name semester year department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear isActive' },
        ],
      })
      .populate('session', 'year semesterLabel isActive');

    return res.status(200).json(assignments);
  } catch (error) {
    console.error('getTeacherSubjectAssignments error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching assignments' });
  }
};

// POST /api/hod/teacher-subjects (Validate section.batch in HOD managed batches)
const createTeacherSubjectAssignment = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, sectionIds } = await getHodScope(req);
    const { teacher, subject, section, session } = req.body;

    if (!teacher || !subject || !section || !session) {
      return res.status(400).json({ message: 'Teacher, Subject, Section, and Academic Session are required.' });
    }

    // Verify teacher exists system-wide (cross-department teacher directory)
    const validTeacher = await User.findOne({ _id: teacher, role: { $in: ['teacher', 'hod'] }, isActive: true });
    if (!validTeacher) {
      return res.status(400).json({ message: 'Selected teacher was not found or is inactive.' });
    }

    const validSection = await Section.findById(section).populate('department');
    if (!validSection) {
      return res.status(404).json({ message: 'Selected section not found.' });
    }

    const isSecAuthorized = sectionIds.some((sId) => sId.toString() === validSection._id.toString()) ||
      (validSection.batch && batchIds.some((bId) => bId.toString() === validSection.batch.toString()));
    if (!isSecAuthorized) {
      return res.status(403).json({
        message: `Access denied. Section '${validSection.name}' is outside your assigned Batches.`,
      });
    }

    const validSubject = await Subject.findById(subject);
    if (!validSubject) {
      return res.status(404).json({ message: 'Selected subject not found.' });
    }

    const existing = await TeacherSubject.findOne({ teacher, subject, section, session });
    if (existing) {
      return res.status(409).json({ message: 'This teacher assignment already exists for this subject, section, and session.' });
    }

    const assignment = new TeacherSubject({
      teacher,
      subject,
      section,
      session,
    });
    await assignment.save();

    const populated = await TeacherSubject.findById(assignment._id)
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('subject', 'name code semester')
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('session', 'year semesterLabel');

    return res.status(201).json(populated);
  } catch (error) {
    console.error('createTeacherSubjectAssignment error:', error);
    return res.status(500).json({ message: error.message || 'Error assigning teacher' });
  }
};

// GET /api/hod/reports/department (Aggregates across all sections for HOD's batches)
const getDepartmentReports = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    const { department, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const [managedSections, settings] = await Promise.all([
      Section.find(secFilter).populate('department', 'name code'),
      Setting.findOne(),
    ]);

    const sectionIds = managedSections.map((s) => s._id);

    const studentFilter = { section: { $in: sectionIds }, isActive: true };
    if (secFilter.batch) {
      studentFilter.batch = secFilter.batch;
    }

    const [attendances, students, periodSlots, teacherAssignments] = await Promise.all([
      Attendance.find({ section: { $in: sectionIds } })
        .populate('teacher', 'name email employeeId')
        .populate('subject', 'name code')
        .populate({
          path: 'section',
          populate: { path: 'department', select: 'name code' },
        })
        .sort({ date: 1 }),
      Student.find(studentFilter).populate('department', 'name code').populate('batch', 'name startYear endYear'),
      PeriodSlot.find({ section: { $in: sectionIds } }),
      TeacherSubject.find({ section: { $in: sectionIds } }).distinct('teacher'),
    ]);

    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    const trendMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trendMap.set(key, { date: key, present: 0, absent: 0, late: 0, percentage: 0 });
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    // Per-Department Breakdown aggregation - strictly for HOD's own course departments
    const deptBreakdownMap = new Map();
    courseDepartments.forEach((d) => {
      deptBreakdownMap.set(d._id.toString(), {
        departmentId: d._id,
        name: d.name,
        code: d.code,
        studentCount: 0,
        sectionCount: 0,
        teacherSet: new Set(),
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        attendancePercentage: 0,
      });
    });

    managedSections.forEach((sec) => {
      const dId = sec.department?._id?.toString() || sec.department?.toString();
      if (dId && deptBreakdownMap.has(dId)) {
        deptBreakdownMap.get(dId).sectionCount += 1;
      }
    });

    students.forEach((st) => {
      const dId = st.department?._id?.toString() || st.department?.toString();
      if (dId && deptBreakdownMap.has(dId)) {
        deptBreakdownMap.get(dId).studentCount += 1;
      }
    });

    attendances.forEach((att) => {
      const dateKey = att.date.toISOString().split('T')[0];
      const dId = att.section?.department?._id?.toString() || att.section?.department?.toString();
      const tId = att.teacher?._id?.toString() || att.teacher?.toString();

      if (tId && dId && deptBreakdownMap.has(dId)) {
        deptBreakdownMap.get(dId).teacherSet.add(tId);
      }

      let p = 0, l = 0, a = 0;
      att.records.forEach((r) => {
        if (r.status === 'present') { p++; totalPresent++; }
        else if (r.status === 'late') { l++; totalLate++; }
        else if (r.status === 'absent') { a++; totalAbsent++; }
      });

      if (dId && deptBreakdownMap.has(dId)) {
        const item = deptBreakdownMap.get(dId);
        item.presentCount += p;
        item.lateCount += l;
        item.absentCount += a;
      }

      if (trendMap.has(dateKey)) {
        const item = trendMap.get(dateKey);
        item.present += p;
        item.late += l;
        item.absent += a;
      }
    });

    const departmentBreakdown = Array.from(deptBreakdownMap.values())
      .filter((dept) => dept.sectionCount > 0 || dept.studentCount > 0)
      .map((dept) => ({
        departmentId: dept.departmentId,
        name: dept.name,
        code: dept.code,
        studentCount: dept.studentCount,
        sectionCount: dept.sectionCount,
        teacherCount: dept.teacherSet.size,
        attendancePercentage: calculateAttendancePercentage(dept.presentCount, dept.lateCount, dept.absentCount),
      }));

    const attendanceTrend = Array.from(trendMap.values()).map((item) => ({
      ...item,
      percentage: calculateAttendancePercentage(item.present, item.late, item.absent),
    }));

    const overallPercentage = calculateAttendancePercentage(totalPresent, totalLate, totalAbsent);

    return res.status(200).json({
      year,
      overallPercentage,
      totalStudents: students.length,
      totalSections: managedSections.length,
      totalTeachers: teacherAssignments.length,
      totalPresent,
      totalLate,
      totalAbsent,
      totalSessionsConducted: attendances.length,
      thresholdPercent: settings?.attendanceThresholdPercent || 75,
      departmentBreakdown,
      attendanceTrend,
    });
  } catch (error) {
    console.error('getDepartmentReports error:', error);
    return res.status(500).json({ message: error.message || 'Error compiling reports' });
  }
};

// GET /api/hod/reports/low-attendance (Students with attendance below threshold in HOD managed batches)
const getLowAttendanceStudents = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, year } = await getHodScope(req);
    const { department, batch } = req.query;
    const settings = await Setting.findOne();
    const threshold = settings?.attendanceThresholdPercent || Number(process.env.ATTENDANCE_THRESHOLD_PERCENT || 75);

    const targetDept = resolveDeptFilter(department, courseDeptIds);

    const secFilter = {
      batch: { $in: batchIds },
      department: targetDept,
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const managedSections = await Section.find(secFilter).select('_id');
    const sectionIds = managedSections.map((s) => s._id);

    const studentFilter = {
      section: { $in: sectionIds },
      department: targetDept,
      isActive: true,
    };
    if (secFilter.batch) {
      studentFilter.batch = secFilter.batch;
    }

    const students = await Student.find(studentFilter)
      .populate('section', 'name semester year batch')
      .populate('department', 'name code')
      .populate('batch', 'name startYear endYear');

    const attendances = await Attendance.find({ section: { $in: sectionIds } })
      .populate('subject', 'name code');

    const studentStats = {};
    students.forEach((st) => {
      studentStats[st._id.toString()] = {
        student: st,
        totalClasses: 0,
        present: 0,
        late: 0,
        absent: 0,
        subjectWise: {},
      };
    });

    attendances.forEach((att) => {
      const subId = att.subject?._id?.toString();
      const subName = att.subject?.name || 'Subject';

      att.records.forEach((rec) => {
        const sId = rec.student?.toString();
        if (studentStats[sId]) {
          studentStats[sId].totalClasses += 1;
          if (rec.status === 'present') studentStats[sId].present += 1;
          else if (rec.status === 'late') studentStats[sId].late += 1;
          else if (rec.status === 'absent') studentStats[sId].absent += 1;

          if (subId) {
            if (!studentStats[sId].subjectWise[subId]) {
              studentStats[sId].subjectWise[subId] = { name: subName, total: 0, present: 0, late: 0, absent: 0 };
            }
            studentStats[sId].subjectWise[subId].total += 1;
            if (rec.status === 'present') studentStats[sId].subjectWise[subId].present += 1;
            else if (rec.status === 'late') studentStats[sId].subjectWise[subId].late += 1;
            else if (rec.status === 'absent') studentStats[sId].subjectWise[subId].absent += 1;
          }
        }
      });
    });

    const lowAttendanceList = [];
    Object.values(studentStats).forEach((item) => {
      const effectivePresent = Math.min(item.totalClasses, item.present + item.late + (item.student.condonedPeriods || 0));
      const percentage = item.totalClasses > 0 ? Number(((effectivePresent / item.totalClasses) * 100).toFixed(1)) : 100;
      if (item.totalClasses > 0 && percentage < threshold) {
        lowAttendanceList.push({
          studentId: item.student._id,
          name: item.student.name,
          rollNumber: item.student.rollNumber,
          departmentName: item.student.department?.name,
          departmentCode: item.student.department?.code,
          section: item.student.section?.name,
          batchName: item.student.batch?.name || '—',
          year: item.student.year || year,
          semester: item.student.semester,
          email: item.student.email,
          phone: item.student.phone,
          totalClasses: item.totalClasses,
          present: item.present,
          late: item.late,
          absent: item.absent,
          condonedPeriods: item.student.condonedPeriods || 0,
          attendancePercentage: percentage,
          deficitClasses: Math.max(0, Math.ceil(((threshold / 100) * item.totalClasses) - effectivePresent)),
          subjectWise: Object.values(item.subjectWise).map((sw) => ({
            ...sw,
            percentage: calculateAttendancePercentage(sw.present, sw.late, sw.absent),
          })),
        });
      }
    });

    lowAttendanceList.sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    return res.status(200).json({
      threshold,
      totalFlagged: lowAttendanceList.length,
      students: lowAttendanceList,
    });
  } catch (error) {
    console.error('getLowAttendanceStudents error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching low attendance reports' });
  }
};

// GET /api/hod/attendance (Attendance records for sections in HOD managed batches)
const getDepartmentAttendanceLogs = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const { department, section, subject, teacher, startDate, endDate, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (section) secFilter._id = section;
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const managedSections = await Section.find(secFilter).select('_id');
    const sectionIds = managedSections.map((s) => s._id);

    const filter = { section: { $in: sectionIds } };
    if (subject) filter.subject = subject;
    if (teacher) filter.teacher = teacher;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const attendances = await Attendance.find(filter)
      .populate('teacher', 'name email employeeId')
      .populate('subject', 'name code semester batch')
      .populate({
        path: 'section',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear isActive' },
        ],
      })
      .populate({
        path: 'periodSlot',
        populate: { path: 'batch', select: 'name startYear endYear isActive' },
      })
      .populate('records.student', 'name rollNumber')
      .sort({ date: -1, markedAt: -1 })
      .limit(200);

    return res.status(200).json(attendances);
  } catch (error) {
    console.error('getDepartmentAttendanceLogs error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching attendance logs' });
  }
};

// GET /api/hod/defaulters (Defaulter analysis scoped to HOD managed batches)
const getHodDefaulters = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, year } = await getHodScope(req);
    const { month, startDate, endDate, department, subject, mode, batch, batchId } = req.query;

    let scopedDeptId = null;
    let scopedDeptIds = courseDeptIds;
    if (department && department !== 'all') {
      const isAllowed = courseDeptIds.some((id) => id.toString() === department.toString());
      if (isAllowed) {
        scopedDeptId = department;
        scopedDeptIds = null;
      } else {
        scopedDeptId = null;
        scopedDeptIds = []; // Disallow foreign department
      }
    }

    let resolvedBatchId = null;
    let resolvedBatchIds = batchIds;
    const reqBatch = batchId || batch;
    if (reqBatch && reqBatch !== 'all' && mongoose.Types.ObjectId.isValid(reqBatch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === reqBatch.toString());
      if (isAllowed) {
        resolvedBatchId = reqBatch;
        resolvedBatchIds = null;
      }
    }

    const data = await calculateDefaulters({
      month,
      startDate,
      endDate,
      departmentId: scopedDeptId,
      departmentIds: scopedDeptIds,
      year,
      subjectId: subject || null,
      batchId: resolvedBatchId,
      batchIds: resolvedBatchIds,
      mode: mode || (subject ? 'subject' : 'overall'),
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('getHodDefaulters error:', error);
    return res.status(500).json({ message: error.message || 'Error calculating defaulters' });
  }
};

// GET /api/hod/teachers/export-pdf
const exportHodTeachersPdf = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const sections = await Section.find(secFilter).select('_id');
    const secIds = sections.map((s) => s._id);

    const [assignedTeacherIds, slotTeacherIds, settings] = await Promise.all([
      TeacherSubject.find({ section: { $in: secIds } }).distinct('teacher'),
      PeriodSlot.find({ section: { $in: secIds }, isRecess: { $ne: true } }).distinct('teacher'),
      Setting.findOne(),
    ]);
    const institutionName = settings?.institutionName || 'AttendEdge Institute of Technology';
    const allTeacherIds = Array.from(new Set([...assignedTeacherIds, ...slotTeacherIds].filter(Boolean).map((id) => id.toString())));

    const teachers = await User.find({ _id: { $in: allTeacherIds }, isActive: true })
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .sort({ name: 1 });

    const assignments = await TeacherSubject.find({ section: { $in: secIds } })
      .populate('subject', 'name code')
      .populate('section', 'name');

    const rows = teachers.map((t) => {
      const myAssigned = assignments
        .filter((a) => (a.teacher?._id || a.teacher)?.toString() === t._id.toString())
        .map((a) => `${a.subject?.code || a.subject?.name} (${a.section?.name})`)
        .join(', ');

      return {
        name: t.name,
        email: t.email,
        employeeId: t.employeeId || '—',
        phone: t.phone || '—',
        homeDept: t.department?.name ? `${t.department.name} (${t.department.code})` : 'Campus Faculty',
        assignedSubjects: myAssigned || '—',
      };
    });

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Faculty Members Directory · Year ${year}`,
      subtitle: `Instructors teaching ${courseDoc?.code || ''} Year ${year} class sections across departments`,
      institutionName,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        Department: department && department !== 'all' ? department : 'All Course Departments',
      },
      columns: [
        { header: 'Faculty Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Employee ID', key: 'employeeId', align: 'center' },
        { header: 'Home Department', key: 'homeDept' },
        { header: 'Assigned Subjects (Sections)', key: 'assignedSubjects' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="faculty_year_${year}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodTeachersPdf error:', err);
    return res.status(500).json({ message: 'Error generating faculty PDF', error: err.message });
  }
};

// GET /api/hod/teacher-subjects/export
const exportHodTeacherSubjectsCsv = async (req, res) => {
  try {
    const { batchIds, courseDeptIds, year } = await getHodScope(req);
    const { department, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

    const assignments = await TeacherSubject.find({ section: { $in: sectionIds } })
      .populate({ path: 'teacher', select: 'name email employeeId department' })
      .populate({ path: 'subject', select: 'name code semester credits department' })
      .populate({
        path: 'section',
        select: 'name semester year department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name' },
        ],
      })
      .populate('session', 'year semesterLabel');

    const rows = assignments.map((a) => ({
      departmentCode: a.section?.department?.code || '',
      subjectCode: a.subject?.code || '',
      subjectName: a.subject?.name || '',
      sectionName: a.section?.name || '',
      year: a.section?.year || year,
      batchName: a.section?.batch?.name || '',
      sessionLabel: a.session?.semesterLabel || '',
      teacherName: a.teacher?.name || '',
      teacherEmployeeId: a.teacher?.employeeId || '',
      teacherEmail: a.teacher?.email || '',
    }));

    const csvData = toCsv(rows, [
      'departmentCode',
      'subjectCode',
      'subjectName',
      'sectionName',
      'year',
      'batchName',
      'sessionLabel',
      'teacherName',
      'teacherEmployeeId',
      'teacherEmail',
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="subject_allocations_year_${year}.csv"`);
    return res.status(200).send(csvData);
  } catch (err) {
    console.error('exportHodTeacherSubjectsCsv error:', err);
    return res.status(500).json({ message: 'Error exporting subject allocations CSV' });
  }
};

// GET /api/hod/teacher-subjects/export-pdf
const exportHodTeacherSubjectsPdf = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    const { department, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

    const [assignments, settings] = await Promise.all([
      TeacherSubject.find({ section: { $in: sectionIds } })
        .populate({
          path: 'teacher',
          select: 'name email employeeId department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate({ path: 'subject', select: 'name code semester credits' })
        .populate({
          path: 'section',
          select: 'name semester year department batch',
          populate: [
            { path: 'department', select: 'name code' },
            { path: 'batch', select: 'name' },
          ],
        })
        .populate('session', 'year semesterLabel'),
      Setting.findOne(),
    ]);

    const institutionName = settings?.institutionName || 'AttendEdge Institute of Technology';

    const rows = assignments.map((a) => ({
      teacherName: a.teacher?.name || '—',
      teacherDept: a.teacher?.department?.code ? `${a.teacher.department.code} Dept` : 'Campus',
      subject: a.subject ? `${a.subject.name} (${a.subject.code})` : '—',
      section: a.section?.name || '—',
      department: a.section?.department?.code || '—',
      batch: a.section?.batch?.name ? `${a.section.batch.name} Batch` : '—',
      session: a.session ? `${a.session.year} · ${a.session.semesterLabel}` : '—',
    }));

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Faculty Subject Allocations · Year ${year}`,
      subtitle: `Instructor allocations for ${courseDoc?.code || ''} Year ${year} sections with batch cohorts & academic sessions`,
      institutionName,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        Department: department && department !== 'all' ? department : 'All Course Departments',
      },
      columns: [
        {
          header: 'Assigned Faculty',
          render: (r) => `<strong>${r.teacherName}</strong> <span class="badge badge-purple" style="margin-left:4px">${r.teacherDept}</span>`,
        },
        { header: 'Subject (Code)', key: 'subject' },
        { header: 'Dept / Section', render: (r) => `${r.department} · ${r.section}`, align: 'center' },
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
    res.setHeader('Content-Disposition', `attachment; filename="subject_allocations_year_${year}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodTeacherSubjectsPdf error:', err);
    return res.status(500).json({ message: 'Error generating subject allocations PDF', error: err.message });
  }
};

// POST /api/hod/teacher-subjects/import
const importHodTeacherSubjectsCsv = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'CSV file is required.' });
    }
    const { batchIds, courseDeptIds, sectionIds } = await getHodScope(req);
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const [departments, sections, subjects, teachers, sessions] = await Promise.all([
      Department.find({ _id: { $in: courseDeptIds } }).populate('course'),
      Section.find({ batch: { $in: batchIds } }).populate({ path: 'department', populate: { path: 'course' } }).populate('session'),
      Subject.find({ batch: { $in: batchIds } }),
      User.find({ role: { $in: ['teacher', 'hod'] }, isActive: true }),
      AcademicSession.find(),
    ]);

    const activeSession = sessions.find((s) => s.isActive) || sessions[0];
    const deptMap = new Map();
    departments.forEach((d) => deptMap.set(d.code.toUpperCase(), d._id));

    const teacherMap = new Map();
    teachers.forEach((t) => {
      if (t.employeeId) teacherMap.set(t.employeeId.toUpperCase(), t._id);
      teacherMap.set(t.email.toLowerCase(), t._id);
    });

    for (const [index, row] of rows.entries()) {
      const lineNum = index + 2;
      const deptCode = (row.departmentCode || row.department || '').toUpperCase().trim();
      const subCode = (row.subjectCode || row.subject || '').toUpperCase().trim();
      const secName = (row.sectionName || row.section || '').toUpperCase().trim();
      const teacherEmpId = (row.teacherEmployeeId || row.teacher || '').toUpperCase().trim();

      if (!deptCode || !subCode || !secName || !teacherEmpId) {
        errors.push({
          row: lineNum,
          reason: 'departmentCode, subjectCode, sectionName, and teacherEmployeeId are all required.',
        });
        skipped++;
        continue;
      }

      const deptId = deptMap.get(deptCode);
      if (!deptId) {
        errors.push({
          row: lineNum,
          reason: `Department code '${deptCode}' not found in your assigned Course.`,
        });
        skipped++;
        continue;
      }

      const secDoc = sections.find(
        (s) =>
          s.department?._id?.toString() === deptId.toString() &&
          s.name.toUpperCase() === secName
      );

      if (!secDoc) {
        errors.push({
          row: lineNum,
          reason: `Section '${secName}' not found in department '${deptCode}' within your managed batches.`,
        });
        skipped++;
        continue;
      }

      const subDoc = subjects.find(
        (s) =>
          s.department?.toString() === deptId.toString() &&
          s.code.toUpperCase() === subCode
      );
      if (!subDoc) {
        errors.push({
          row: lineNum,
          reason: `Subject code '${subCode}' not found in department '${deptCode}'.`,
        });
        skipped++;
        continue;
      }

      const teacherId = teacherMap.get(teacherEmpId) || teacherMap.get(teacherEmpId.toLowerCase());
      if (!teacherId) {
        errors.push({
          row: lineNum,
          reason: `Teacher with Employee ID / Email '${teacherEmpId}' not found.`,
        });
        skipped++;
        continue;
      }

      const sessionId = secDoc.session?._id || secDoc.session || activeSession?._id;
      if (!sessionId) {
        errors.push({ row: lineNum, reason: 'No active academic session found for this section.' });
        skipped++;
        continue;
      }

      const existing = await TeacherSubject.findOne({
        subject: subDoc._id,
        section: secDoc._id,
        session: sessionId,
      });

      if (existing) {
        existing.teacher = teacherId;
        await existing.save();
        updated++;
      } else {
        const assignment = new TeacherSubject({
          teacher: teacherId,
          subject: subDoc._id,
          section: secDoc._id,
          session: sessionId,
        });
        await assignment.save();
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
    console.error('importHodTeacherSubjectsCsv error:', err);
    return res.status(500).json({ message: 'Error importing subject allocations', error: err.message });
  }
};

// GET /api/hod/timetable/export-timetable-pdf
const exportHodTimetablePdf = async (req, res) => {
  try {
    const { batchIds, courseDeptIds } = await getHodScope(req);
    const section = req.query.section || req.query.sectionId;
    if (!section) {
      return res.status(400).json({ message: 'Section ID query parameter is required.' });
    }

    const [sectionDoc, settings] = await Promise.all([
      Section.findById(section)
        .populate({ path: 'department', populate: { path: 'course' } })
        .populate('session')
        .populate('batch'),
      Setting.findOne(),
    ]);

    const institutionName = settings?.institutionName || 'AttendEdge Institute of Technology';

    if (!sectionDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // Scoping check
    const isBatchAllowed = sectionDoc.batch && batchIds.some((bId) => bId.toString() === sectionDoc.batch._id?.toString() || bId.toString() === sectionDoc.batch.toString());
    if (!isBatchAllowed) {
      return res.status(403).json({
        message: `Access denied: Section '${sectionDoc.name}' is outside your managed Batches.`,
      });
    }

    // 1. Fetch configured period templates for this section
    const templates = await PeriodTemplate.find({ section }).sort({ periodNumber: 1 });

    // 2. Fetch scheduled period slots for this section
    const slots = await PeriodSlot.find({ section })
      .populate('subject', 'name code')
      .populate('teacher', 'name email employeeId')
      .populate('batch', 'name');

    // 3. Dynamic Period Determination: Iterate over ONLY active period templates / configured periods
    let periods = [];
    if (templates.length > 0) {
      periods = templates.map((t) => ({
        periodNumber: t.periodNumber,
        label: t.label || `Period ${t.periodNumber}`,
        startTime: t.startTime,
        endTime: t.endTime,
        isRecess: Boolean(t.isRecess),
      }));
    } else if (slots.length > 0) {
      const slotPeriodMap = new Map();
      slots.forEach((s) => {
        if (!slotPeriodMap.has(s.periodNumber)) {
          slotPeriodMap.set(s.periodNumber, {
            periodNumber: s.periodNumber,
            label: `Period ${s.periodNumber}`,
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '10:00',
            isRecess: Boolean(s.isRecess),
          });
        }
      });
      periods = Array.from(slotPeriodMap.values()).sort((a, b) => a.periodNumber - b.periodNumber);
    } else {
      periods = [];
    }

    const html = buildTimetablePdfHtml({
      section: sectionDoc,
      course: sectionDoc.department?.course,
      department: sectionDoc.department,
      session: sectionDoc.session,
      periods,
      slots,
      institutionName,
    });

    const pdfBuffer = await generatePdf(html, { landscape: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sectionDoc.name}_Weekly_Timetable.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodTimetablePdf error:', err);
    return res.status(500).json({ message: 'Error generating timetable PDF', error: err.message });
  }
};

// GET /api/hod/defaulters/export-pdf
const exportHodDefaultersPdf = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    let { month, startDate, endDate, department, subject, mode, batch, batchId } = req.query;

    const settings = await Setting.findOne();
    const institutionName = settings?.institutionName || settings?.collegeName || 'Everest College';
    const threshold = settings?.attendanceThresholdPercent ?? settings?.attendanceThreshold ?? 75;

    if (!startDate && !endDate && !month) {
      month = new Date().toISOString().slice(0, 7);
    }

    let scopedDeptId = null;
    let scopedDeptIds = courseDeptIds;
    if (department && department !== 'all') {
      const isAllowed = courseDeptIds.some((id) => id.toString() === department.toString());
      if (isAllowed) {
        scopedDeptId = department;
        scopedDeptIds = null;
      } else {
        scopedDeptId = null;
        scopedDeptIds = [];
      }
    }

    let resolvedBatchId = null;
    let resolvedBatchIds = batchIds;
    const reqBatch = batchId || batch;
    if (reqBatch && reqBatch !== 'all' && mongoose.Types.ObjectId.isValid(reqBatch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === reqBatch.toString());
      if (isAllowed) {
        resolvedBatchId = reqBatch;
        resolvedBatchIds = null;
      }
    }

    const data = await calculateDefaulters({
      month,
      startDate,
      endDate,
      departmentId: scopedDeptId,
      departmentIds: scopedDeptIds,
      year,
      subjectId: subject || null,
      batchId: resolvedBatchId,
      batchIds: resolvedBatchIds,
      mode: mode || (subject ? 'subject' : 'overall'),
      threshold,
    });

    let batchLabel = '';
    if (batch || batchId) {
      const bDoc = await Batch.findById(batchId || batch);
      if (bDoc) batchLabel = bDoc.name;
    }

    const rows = (data.defaulters || []).map((d) => ({
      rollNumber: d.rollNumber || 'N/A',
      name: d.name || 'N/A',
      dept: d.departmentName || d.department || d.departmentCode || 'N/A',
      batch: d.batchName || batchLabel || '—',
      section: d.section || d.sectionName || 'N/A',
      attended: `${d.present != null ? d.present : (d.attended != null ? d.attended : 'N/A')} / ${d.totalPeriods != null ? d.totalPeriods : 'N/A'}`,
      percentage: `${d.percentage != null && !isNaN(d.percentage) ? d.percentage : 'N/A'}%`,
    }));

    const courseDoc = courseDepartments[0]?.course;
    const periodLabel = data.rangeLabel || month || `${startDate} to ${endDate}`;
    const fileSuffix = data.rangeLabel ? data.rangeLabel.replace(/[^a-zA-Z0-9_-]/g, '_') : (month || 'custom_range');

    const html = buildGenericTablePdfHtml({
      title: `Attendance Defaulters Report · ${periodLabel}`,
      subtitle: `Students falling below mandatory attendance threshold (${data.thresholdPercent || threshold}%) in ${courseDoc?.code || ''}`,
      institutionName,
      filters: {
        Course: courseDoc?.code || '—',
        ...(batchLabel ? { Batch: batchLabel } : {}),
        Period: periodLabel,
        Mode: data.mode === 'subject' ? 'Subject-wise' : 'Overall',
        Threshold: `${data.thresholdPercent || threshold}%`,
      },
      columns: [
        { header: 'Roll No', key: 'rollNumber', align: 'center' },
        { header: 'Student Name', key: 'name' },
        { header: 'Department', key: 'dept', align: 'center' },
        { header: 'Cohort Batch', key: 'batch', align: 'center' },
        { header: 'Section', key: 'section', align: 'center' },
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
    res.setHeader('Content-Disposition', `attachment; filename="hod_defaulters_${fileSuffix}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodDefaultersPdf error:', err);
    return res.status(500).json({ message: 'Error generating defaulters PDF', error: err.message });
  }
};

// GET /api/hod/reports/export-pdf
const exportHodReportsPdf = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    const { department, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const yearSections = await Section.find(secFilter).populate('department', 'name code');
    const sectionIds = yearSections.map((s) => s._id);

    const studentFilter = { section: { $in: sectionIds }, isActive: true };
    if (secFilter.batch) {
      studentFilter.batch = secFilter.batch;
    }

    let batchLabel = '';
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const bDoc = await Batch.findById(batch);
      if (bDoc) batchLabel = bDoc.name;
    }

    const [attendances, students, settings] = await Promise.all([
      Attendance.find({ section: { $in: sectionIds } }).populate({ path: 'section', populate: { path: 'department' } }),
      Student.find(studentFilter).populate('department', 'name code'),
      Setting.findOne(),
    ]);

    const institutionName = settings?.institutionName || 'AttendEdge Institute of Technology';

    const deptBreakdownMap = new Map();
    courseDepartments.forEach((d) => {
      deptBreakdownMap.set(d._id.toString(), {
        name: d.name,
        code: d.code,
        studentCount: 0,
        sectionCount: 0,
        present: 0,
        late: 0,
        absent: 0,
      });
    });

    yearSections.forEach((sec) => {
      const dId = sec.department?._id?.toString() || sec.department?.toString();
      if (dId && deptBreakdownMap.has(dId)) {
        deptBreakdownMap.get(dId).sectionCount += 1;
      }
    });

    students.forEach((st) => {
      const dId = st.department?._id?.toString() || st.department?.toString();
      if (dId && deptBreakdownMap.has(dId)) {
        deptBreakdownMap.get(dId).studentCount += 1;
      }
    });

    attendances.forEach((att) => {
      const dId = att.section?.department?._id?.toString() || att.section?.department?.toString();
      let p = 0, l = 0, a = 0;
      att.records.forEach((r) => {
        if (r.status === 'present') p++;
        else if (r.status === 'late') l++;
        else if (r.status === 'absent') a++;
      });
      if (dId && deptBreakdownMap.has(dId)) {
        const item = deptBreakdownMap.get(dId);
        item.present += p;
        item.late += l;
        item.absent += a;
      }
    });

    const rows = Array.from(deptBreakdownMap.values())
      .filter((dept) => dept.sectionCount > 0 || dept.studentCount > 0)
      .map((d) => ({
        deptName: `${d.name} (${d.code})`,
        sections: d.sectionCount,
        students: d.studentCount,
        attendance: `${calculateAttendancePercentage(d.present, d.late, d.absent)}%`,
      }));

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Academic Performance Report · Year ${year}`,
      subtitle: `Department breakdown and attendance metrics for ${courseDoc?.code || ''} Year ${year}`,
      institutionName,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        ...(batchLabel ? { Batch: batchLabel } : {}),
        'Total Sections': yearSections.length,
        'Active Students': students.length,
      },
      columns: [
        { header: 'Department', key: 'deptName' },
        { header: 'Active Sections', key: 'sections', align: 'center' },
        { header: 'Enrolled Students', key: 'students', align: 'center' },
        {
          header: 'Average Attendance',
          render: (r) => `<span class="badge badge-emerald font-bold">${r.attendance}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="hod_reports_year_${year}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodReportsPdf error:', err);
    return res.status(500).json({ message: 'Error generating reports PDF', error: err.message });
  }
};

// GET /api/hod/attendance/export-pdf
const exportHodAttendancePdf = async (req, res) => {
  try {
    const { batchIds, courseDepartments, courseDeptIds, year } = await getHodScope(req);
    const { department, section, subject, teacher, startDate, endDate, batch } = req.query;

    const secFilter = {
      batch: { $in: batchIds },
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (section) secFilter._id = section;
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const isAllowed = batchIds.some((bId) => bId.toString() === batch.toString());
      secFilter.batch = isAllowed ? batch : { $in: [] };
    }

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

    const filter = { section: { $in: sectionIds } };
    if (subject) filter.subject = subject;
    if (teacher) filter.teacher = teacher;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    let batchLabel = '';
    if (batch && batch !== 'all' && mongoose.Types.ObjectId.isValid(batch)) {
      const bDoc = await Batch.findById(batch);
      if (bDoc) batchLabel = bDoc.name;
    }

    const [attendances, settings] = await Promise.all([
      Attendance.find(filter)
        .populate('teacher', 'name email employeeId')
        .populate('subject', 'name code')
        .populate({
          path: 'section',
          populate: [
            { path: 'department', select: 'name code' },
            { path: 'batch', select: 'name startYear endYear isActive' },
          ],
        })
        .populate({
          path: 'periodSlot',
          populate: { path: 'batch', select: 'name startYear endYear isActive' },
        })
        .sort({ date: -1, markedAt: -1 })
        .limit(200),
      Setting.findOne(),
    ]);

    const institutionName = settings?.institutionName || 'AttendEdge Institute of Technology';

    const rows = attendances.map((att) => {
      const p = att.records.filter((r) => r.status === 'present').length;
      const l = att.records.filter((r) => r.status === 'late').length;
      const a = att.records.filter((r) => r.status === 'absent').length;
      const total = att.records.length;
      const pct = total > 0 ? calculateAttendancePercentage(p, l, a) : 0;
      const bName = att.section?.batch?.name || att.periodSlot?.batch?.name || batchLabel || '—';

      return {
        date: new Date(att.date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        subject: att.subject ? `${att.subject.name} (${att.subject.code})` : '—',
        section: att.section?.name || '—',
        dept: att.section?.department?.code || '—',
        batch: bName,
        teacher: att.teacher?.name || '—',
        counts: `${p}P / ${l}L / ${a}A (Total ${total})`,
        percentage: `${pct}%`,
      };
    });

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Attendance Audit Trail · Year ${year}`,
      subtitle: `Official record of classroom attendance logs conducted in ${courseDoc?.code || ''} Year ${year}`,
      institutionName,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        Department: department && department !== 'all' ? department : 'All Course Departments',
        ...(batchLabel ? { Batch: batchLabel } : {}),
      },
      columns: [
        { header: 'Lecture Date', key: 'date', align: 'center' },
        { header: 'Subject (Code)', key: 'subject' },
        { header: 'Dept / Section', render: (r) => `${r.dept} · ${r.section}`, align: 'center' },
        { header: 'Cohort Batch', key: 'batch', align: 'center' },
        { header: 'Faculty Instructor', key: 'teacher' },
        { header: 'Breakdown (P/L/A)', key: 'counts', align: 'center' },
        {
          header: 'Turnout %',
          render: (r) => `<span class="badge badge-emerald font-bold">${r.percentage}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="hod_attendance_audit_year_${year}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodAttendancePdf error:', err);
    return res.status(500).json({ message: 'Error generating attendance PDF', error: err.message });
  }
};

module.exports = {
  getTeacherDirectory,
  getDepartments,
  getBatches,
  getDepartmentTeachers,
  createStaff,
  updateStaff,
  deleteStaff,
  getDepartmentSubjects,
  createSubject,
  updateSubject,
  archiveSubject,
  restoreSubject,
  deleteSubject,
  forceDeleteSubject,
  getDepartmentSections,
  getTeacherSubjectAssignments,
  createTeacherSubjectAssignment,
  updateTeacherSubjectAssignment,
  deleteTeacherSubjectAssignment,
  getDepartmentReports,
  getLowAttendanceStudents,
  getDepartmentAttendanceLogs,
  getHodDefaulters,
  exportHodTeachersPdf,
  exportHodTeacherSubjectsCsv,
  exportHodTeacherSubjectsPdf,
  importHodTeacherSubjectsCsv,
  exportHodTimetablePdf,
  exportHodDefaultersPdf,
  exportHodReportsPdf,
  exportHodAttendancePdf,
};

