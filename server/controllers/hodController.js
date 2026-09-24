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

// Helper to ensure HOD has Course + Year assigned and retrieve Course departments
const getHodScope = async (req) => {
  const year = req.user?.year;
  const course = req.user?.course?._id || req.user?.course;
  if (!year) {
    throw new Error('HOD user account does not have an assigned Academic Year (1st, 2nd, 3rd, or 4th Year).');
  }
  if (!course) {
    throw new Error('HOD user account does not have an assigned Course (e.g., B.Tech, Diploma).');
  }

  const courseDepartments = await Department.find({ course }).populate('course', 'name code durationYears').sort({ name: 1 });
  const courseDeptIds = courseDepartments.map((d) => d._id);

  return {
    year: Number(year),
    courseId: course.toString(),
    courseDepartments,
    courseDeptIds,
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

// GET /api/hod/teacher-directory (Cross-department teacher list for assignment picking - UNCHANGED)
const getTeacherDirectory = async (req, res) => {
  try {
    const teachers = await User.find({ role: { $in: ['teacher', 'hod'] }, isActive: true })
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .select('name email employeeId phone department role year course')
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error('getTeacherDirectory error:', error);
    return res.status(500).json({ message: 'Error fetching teacher directory' });
  }
};

// GET /api/hod/teachers (Distinct teachers who have at least one TeacherSubject in this Course+Year)
const getDepartmentTeachers = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const sections = await Section.find(secFilter).select('_id');
    const secIds = sections.map((s) => s._id);

    const assignedTeacherIds = await TeacherSubject.find({ section: { $in: secIds } }).distinct('teacher');
    
    // Also include teachers scheduled in PeriodSlots for this year & course
    const slotTeacherIds = await PeriodSlot.find({ section: { $in: secIds }, isRecess: { $ne: true } }).distinct('teacher');
    const validAssignedIds = assignedTeacherIds.filter(Boolean).map((id) => id.toString());
    const validSlotIds = slotTeacherIds.filter(Boolean).map((id) => id.toString());
    const allTeacherIds = Array.from(new Set([...validAssignedIds, ...validSlotIds]));

    const teachers = await User.find({ _id: { $in: allTeacherIds }, isActive: true })
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .select('-passwordHash')
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error('getDepartmentTeachers error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching year faculty' });
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

// GET /api/hod/subjects (Subjects for this Course+Year, filterable by department & semester)
const getDepartmentSubjects = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department, semester } = req.query;

    const subFilter = {
      department: resolveDeptFilter(department, courseDeptIds),
      $or: [
        { year },
        { year: null, semester: { $in: [year * 2 - 1, year * 2] } },
      ],
    };

    if (semester && semester !== 'all') subFilter.semester = Number(semester);

    const subjects = await Subject.find(subFilter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .sort({ semester: 1, code: 1 });

    return res.status(200).json(subjects);
  } catch (error) {
    console.error('getDepartmentSubjects error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching year subjects' });
  }
};

// GET /api/hod/sections (All sections in this Course+Year)
const getDepartmentSections = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department, session } = req.query;

    const filter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (session) filter.session = session;

    const sections = await Section.find(filter)
      .populate({ path: 'department', populate: { path: 'course', select: 'name code' } })
      .populate('session', 'year semesterLabel isActive')
      .populate('batch', 'name startYear endYear isActive')
      .sort({ department: 1, semester: 1, name: 1 });

    return res.status(200).json(sections);
  } catch (error) {
    console.error('getDepartmentSections error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching year sections' });
  }
};

// GET /api/hod/teacher-subjects (Teacher assignments for sections in this Course+Year)
const getTeacherSubjectAssignments = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

    const assignments = await TeacherSubject.find({ section: { $in: sectionIds } })
      .populate({
        path: 'teacher',
        select: 'name email employeeId department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate({
        path: 'subject',
        select: 'name code semester credits department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate({
        path: 'section',
        select: 'name semester year department batch',
        populate: [
          { path: 'department', select: 'name code' },
          { path: 'batch', select: 'name startYear endYear' },
        ],
      })
      .populate('session', 'year semesterLabel isActive');

    return res.status(200).json(assignments);
  } catch (error) {
    console.error('getTeacherSubjectAssignments error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching assignments' });
  }
};

// POST /api/hod/teacher-subjects (Validate section.year === req.user.year AND section.department belongs to HOD course)
const createTeacherSubjectAssignment = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
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

    if (Number(validSection.year) !== year) {
      return res.status(403).json({
        message: `Access denied. Section '${validSection.name}' belongs to Year ${validSection.year}, but you are the HOD for Year ${year}.`,
      });
    }

    const secDeptId = validSection.department?._id?.toString() || validSection.department?.toString();
    const isDeptInCourse = courseDeptIds.some((id) => id.toString() === secDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({
        message: `Access denied. Section '${validSection.name}' does not belong to your assigned Course.`,
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

// GET /api/hod/reports/department (Aggregates across all sections for req.user.course + req.user.year with per-department breakdown)
const getDepartmentReports = async (req, res) => {
  try {
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const [yearSections, settings] = await Promise.all([
      Section.find(secFilter).populate('department', 'name code'),
      Setting.findOne(),
    ]);

    const sectionIds = yearSections.map((s) => s._id);

    const [attendances, students, periodSlots, teacherAssignments] = await Promise.all([
      Attendance.find({ section: { $in: sectionIds } })
        .populate('teacher', 'name email employeeId')
        .populate('subject', 'name code')
        .populate({
          path: 'section',
          populate: { path: 'department', select: 'name code' },
        })
        .sort({ date: 1 }),
      Student.find({ section: { $in: sectionIds }, isActive: true }).populate('department', 'name code'),
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
      totalSections: yearSections.length,
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
    return res.status(500).json({ message: error.message || 'Error compiling year reports' });
  }
};

// GET /api/hod/reports/low-attendance (Students with attendance below threshold in req.user.course + req.user.year)
const getLowAttendanceStudents = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;
    const settings = await Setting.findOne();
    const threshold = settings?.attendanceThresholdPercent || Number(process.env.ATTENDANCE_THRESHOLD_PERCENT || 75);

    const targetDept = resolveDeptFilter(department, courseDeptIds);

    const studentFilter = {
      year,
      department: targetDept,
      isActive: true,
    };

    const students = await Student.find(studentFilter)
      .populate('section', 'name semester year')
      .populate('department', 'name code');

    const secFilter = {
      year,
      department: targetDept,
    };

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

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
      const percentage = calculateAttendancePercentage(item.present, item.late, item.absent);
      if (item.totalClasses > 0 && percentage < threshold) {
        lowAttendanceList.push({
          studentId: item.student._id,
          name: item.student.name,
          rollNumber: item.student.rollNumber,
          departmentName: item.student.department?.name,
          departmentCode: item.student.department?.code,
          section: item.student.section?.name,
          year: item.student.year || year,
          semester: item.student.semester,
          email: item.student.email,
          phone: item.student.phone,
          totalClasses: item.totalClasses,
          present: item.present,
          late: item.late,
          absent: item.absent,
          attendancePercentage: percentage,
          deficitClasses: Math.ceil(((threshold / 100) * item.totalClasses) - (item.present + item.late)),
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

// GET /api/hod/attendance (Attendance records for sections in req.user.course + req.user.year)
const getDepartmentAttendanceLogs = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { department, section, subject, teacher, startDate, endDate } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (section) secFilter._id = section;

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

    const attendances = await Attendance.find(filter)
      .populate('teacher', 'name email employeeId')
      .populate('subject', 'name code semester')
      .populate({
        path: 'section',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('records.student', 'name rollNumber')
      .sort({ date: -1, markedAt: -1 })
      .limit(100);

    return res.status(200).json(attendances);
  } catch (error) {
    console.error('getDepartmentAttendanceLogs error:', error);
    return res.status(500).json({ message: error.message || 'Error fetching attendance logs' });
  }
};

// GET /api/hod/defaulters (Defaulter analysis scoped to req.user.course + req.user.year)
const getHodDefaulters = async (req, res) => {
  try {
    const { year, courseDeptIds } = await getHodScope(req);
    const { month, department, subject, mode } = req.query;

    if (!month) {
      return res.status(400).json({ message: 'Month query parameter in YYYY-MM format is required.' });
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
        scopedDeptIds = []; // Disallow foreign department
      }
    }

    const data = await calculateDefaulters({
      month,
      departmentId: scopedDeptId,
      departmentIds: scopedDeptIds,
      year,
      subjectId: subject || null,
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
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const sections = await Section.find(secFilter).select('_id');
    const secIds = sections.map((s) => s._id);

    const assignedTeacherIds = await TeacherSubject.find({ section: { $in: secIds } }).distinct('teacher');
    const slotTeacherIds = await PeriodSlot.find({ section: { $in: secIds }, isRecess: { $ne: true } }).distinct('teacher');
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
    const { year, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

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
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const yearSections = await Section.find(secFilter).select('_id');
    const sectionIds = yearSections.map((s) => s._id);

    const assignments = await TeacherSubject.find({ section: { $in: sectionIds } })
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
      .populate('session', 'year semesterLabel');

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
    const { year, courseDeptIds } = await getHodScope(req);
    const rows = parseCsv(req.file.buffer);
    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    const [departments, sections, subjects, teachers, sessions] = await Promise.all([
      Department.find({ _id: { $in: courseDeptIds } }).populate('course'),
      Section.find().populate({ path: 'department', populate: { path: 'course' } }).populate('session'),
      Subject.find(),
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
          reason: `Section '${secName}' not found in department '${deptCode}'.`,
        });
        skipped++;
        continue;
      }

      // STRICT SCOPING CHECK
      if (Number(secDoc.year) !== year) {
        errors.push({
          row: lineNum,
          reason: `Access denied: Section '${secDoc.name}' belongs to Year ${secDoc.year}, which is outside your assigned Year ${year}.`,
        });
        skipped++;
        continue;
      }

      const secDeptCourseId = secDoc.department?.course?._id?.toString() || secDoc.department?.course?.toString();
      const hodCourseId = req.user?.course?._id?.toString() || req.user?.course?.toString();
      if (hodCourseId && secDeptCourseId !== hodCourseId) {
        errors.push({
          row: lineNum,
          reason: `Access denied: Section '${secDoc.name}' does not belong to your assigned Course.`,
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
    const { year, courseDeptIds } = await getHodScope(req);
    const section = req.query.section || req.query.sectionId;
    if (!section) {
      return res.status(400).json({ message: 'Section ID query parameter is required.' });
    }

    const sectionDoc = await Section.findById(section)
      .populate({ path: 'department', populate: { path: 'course' } })
      .populate('session')
      .populate('batch');

    if (!sectionDoc) {
      return res.status(404).json({ message: 'Section not found.' });
    }

    // Scoping check
    if (Number(sectionDoc.year) !== year) {
      return res.status(403).json({
        message: `Access denied: Section '${sectionDoc.name}' belongs to Year ${sectionDoc.year}, but you are the HOD for Year ${year}.`,
      });
    }

    const secDeptId = sectionDoc.department?._id?.toString() || sectionDoc.department?.toString();
    const isDeptInCourse = courseDeptIds.some((id) => id.toString() === secDeptId);
    if (!isDeptInCourse) {
      return res.status(403).json({
        message: `Access denied: Section '${sectionDoc.name}' does not belong to your assigned Course.`,
      });
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
    console.error('exportHodTimetablePdf error:', err);
    return res.status(500).json({ message: 'Error generating timetable PDF', error: err.message });
  }
};

// GET /api/hod/defaulters/export-pdf
const exportHodDefaultersPdf = async (req, res) => {
  try {
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    let { month, department, subject, mode } = req.query;

    if (!month) {
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

    const data = await calculateDefaulters({
      month,
      departmentId: scopedDeptId,
      departmentIds: scopedDeptIds,
      year,
      subjectId: subject || null,
      mode: mode || (subject ? 'subject' : 'overall'),
    });

    const rows = (data.defaulters || []).map((d) => ({
      rollNumber: d.rollNumber || 'N/A',
      name: d.name || 'N/A',
      dept: d.departmentName || d.department || d.departmentCode || 'N/A',
      section: d.section || d.sectionName || 'N/A',
      attended: `${d.present != null ? d.present : (d.attended != null ? d.attended : 'N/A')} / ${d.totalPeriods != null ? d.totalPeriods : 'N/A'}`,
      percentage: `${d.percentage != null && !isNaN(d.percentage) ? d.percentage : 'N/A'}%`,
    }));

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Year ${year} Attendance Defaulters Report · ${month}`,
      subtitle: `Students falling below mandatory attendance threshold (${data.thresholdPercent || 75}%) in ${courseDoc?.code || ''} Year ${year}`,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        Month: month,
        Mode: data.mode === 'subject' ? 'Subject-wise' : 'Overall',
        Threshold: `${data.thresholdPercent || 75}%`,
      },
      columns: [
        { header: 'Roll No', key: 'rollNumber', align: 'center' },
        { header: 'Student Name', key: 'name' },
        { header: 'Department', key: 'dept', align: 'center' },
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
    res.setHeader('Content-Disposition', `attachment; filename="hod_defaulters_${month}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportHodDefaultersPdf error:', err);
    return res.status(500).json({ message: 'Error generating defaulters PDF', error: err.message });
  }
};

// GET /api/hod/reports/export-pdf
const exportHodReportsPdf = async (req, res) => {
  try {
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    const { department } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };

    const yearSections = await Section.find(secFilter).populate('department', 'name code');
    const sectionIds = yearSections.map((s) => s._id);

    const [attendances, students] = await Promise.all([
      Attendance.find({ section: { $in: sectionIds } }).populate({ path: 'section', populate: { path: 'department' } }),
      Student.find({ section: { $in: sectionIds }, isActive: true }).populate('department', 'name code'),
    ]);

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
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
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
    const { year, courseDepartments, courseDeptIds } = await getHodScope(req);
    const { department, section, subject, teacher, startDate, endDate } = req.query;

    const secFilter = {
      year,
      department: resolveDeptFilter(department, courseDeptIds),
    };
    if (section) secFilter._id = section;

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

    const attendances = await Attendance.find(filter)
      .populate('teacher', 'name email employeeId')
      .populate('subject', 'name code')
      .populate({ path: 'section', populate: { path: 'department', select: 'name code' } })
      .sort({ date: -1, markedAt: -1 })
      .limit(200);

    const rows = attendances.map((att) => {
      const p = att.records.filter((r) => r.status === 'present').length;
      const l = att.records.filter((r) => r.status === 'late').length;
      const a = att.records.filter((r) => r.status === 'absent').length;
      const total = att.records.length;
      const pct = total > 0 ? calculateAttendancePercentage(p, l, a) : 0;

      return {
        date: new Date(att.date).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
        subject: att.subject ? `${att.subject.name} (${att.subject.code})` : '—',
        section: att.section?.name || '—',
        dept: att.section?.department?.code || '—',
        teacher: att.teacher?.name || '—',
        counts: `${p}P / ${l}L / ${a}A (Total ${total})`,
        percentage: `${pct}%`,
      };
    });

    const courseDoc = courseDepartments[0]?.course;
    const html = buildGenericTablePdfHtml({
      title: `Attendance Audit Trail · Year ${year}`,
      subtitle: `Official record of classroom attendance logs conducted in ${courseDoc?.code || ''} Year ${year}`,
      filters: {
        Course: courseDoc?.code || '—',
        'Academic Year': `Year ${year}`,
        Department: department && department !== 'all' ? department : 'All Course Departments',
      },
      columns: [
        { header: 'Lecture Date', key: 'date', align: 'center' },
        { header: 'Subject (Code)', key: 'subject' },
        { header: 'Dept / Section', render: (r) => `${r.dept} · ${r.section}`, align: 'center' },
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
  getDepartmentTeachers,
  getDepartmentSubjects,
  getDepartmentSections,
  getTeacherSubjectAssignments,
  createTeacherSubjectAssignment,
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

