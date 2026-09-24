const Attendance = require('../models/Attendance');
const Section = require('../models/Section');
const Student = require('../models/Student');
const Setting = require('../models/Setting');
const Subject = require('../models/Subject');
const Department = require('../models/Department');

/**
 * Shared Defaulter Aggregation Utility
 * Calculates real live attendance percentage for a given month and flags defaulters (< threshold)
 *
 * @param {Object} params
 * @param {string} params.month - Format YYYY-MM (e.g. '2026-09')
 * @param {string} [params.subjectId] - Optional Subject ObjectId filter
 * @param {string} [params.courseId] - Optional Course ObjectId filter
 * @param {string} [params.departmentId] - Optional Department ObjectId filter
 * @param {Array<string>} [params.departmentIds] - Optional Department ObjectIds array filter
 * @param {number} [params.year] - Optional Year (1, 2, 3, 4)
 * @param {string} [params.sectionId] - Optional Section ObjectId filter
 * @param {string} [params.mode] - 'subject' | 'overall' (defaults to 'subject' if subjectId given, else 'overall')
 * @param {number} [params.threshold] - Optional threshold override
 * @returns {Promise<Object>} { month, threshold, mode, defaulters: Array, stats: Object }
 */
async function calculateDefaulters({
  month,
  subjectId,
  courseId,
  departmentId,
  departmentIds,
  year,
  sectionId,
  mode = 'subject',
  threshold,
}) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Valid month in YYYY-MM format is required (e.g., 2026-09).');
  }

  // Determine date bounds for the month in UTC
  const [yearStr, monthStr] = month.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10); // 1-12
  const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  // Fetch system threshold
  if (!threshold) {
    const setting = await Setting.findOne();
    threshold = setting?.attendanceThresholdPercent || Number(process.env.ATTENDANCE_THRESHOLD_PERCENT || 75);
  }

  // Determine section filter if department or course or year or sectionId specified
  const sectionQuery = {};
  if (departmentId) {
    sectionQuery.department = departmentId;
  } else if (departmentIds && Array.isArray(departmentIds) && departmentIds.length > 0) {
    sectionQuery.department = { $in: departmentIds };
  } else if (courseId) {
    const courseDepts = await Department.find({ course: courseId }).select('_id');
    const courseDeptIds = courseDepts.map((d) => d._id);
    sectionQuery.department = { $in: courseDeptIds };
  }

  if (year) sectionQuery.year = Number(year);
  if (sectionId) sectionQuery._id = sectionId;

  let sectionIds = null;
  if (departmentId || departmentIds || courseId || year || sectionId) {
    const sections = await Section.find(sectionQuery).select('_id');
    sectionIds = sections.map((s) => s._id);
  }

  // Build attendance query
  const attendanceQuery = {
    date: { $gte: startDate, $lte: endDate },
  };

  if (subjectId) {
    attendanceQuery.subject = subjectId;
  }

  if (sectionIds) {
    attendanceQuery.section = { $in: sectionIds };
  }

  // Fetch matching attendance documents with populated section/student department references
  const attendances = await Attendance.find(attendanceQuery)
    .populate('subject', 'name code')
    .populate({
      path: 'section',
      select: 'name year semester department',
      populate: {
        path: 'department',
        select: 'name code course',
        populate: { path: 'course', select: 'name code durationYears' },
      },
    })
    .populate({
      path: 'records.student',
      select: 'name rollNumber section department year isActive',
      populate: {
        path: 'department',
        select: 'name code course',
        populate: { path: 'course', select: 'name code durationYears' },
      },
    });

  // We will map student attendance
  // If mode === 'subject' (or subjectId is provided): key = `${studentId}_${subjectId}`
  // If mode === 'overall': key = `${studentId}`
  const isOverall = !subjectId && mode === 'overall';

  const studentMap = {};

  attendances.forEach((att) => {
    const sub = att.subject;
    const sec = att.section;
    if (!sub || !sec) return;

    // Verify department / year if populated
    const secDeptId = sec.department?._id?.toString() || sec.department?.toString();
    if (departmentId && secDeptId && secDeptId !== departmentId.toString()) return;
    if (year && sec.year && Number(sec.year) !== Number(year)) return;

    att.records.forEach((rec) => {
      const student = rec.student;
      if (!student || student.isActive === false) return;

      const sId = student._id ? student._id.toString() : student.toString();
      const subId = sub._id ? sub._id.toString() : sub.toString();

      const key = isOverall ? sId : `${sId}_${subId}`;

      const deptDoc = (sec.department && typeof sec.department === 'object') ? sec.department : (student.department && typeof student.department === 'object' ? student.department : null);
      const courseDoc = deptDoc?.course && typeof deptDoc.course === 'object' ? deptDoc.course : null;
      const deptName = deptDoc?.name || '—';
      const deptCode = deptDoc?.code || '';
      const courseName = courseDoc?.name || '';
      const courseCode = courseDoc?.code || '';
      const courseDept = courseCode && deptCode ? `${courseCode} · ${deptCode}` : deptCode || deptName;

      if (!studentMap[key]) {
        studentMap[key] = {
          studentId: sId,
          name: student.name || 'Unknown Student',
          rollNumber: student.rollNumber || '—',
          departmentName: deptName,
          departmentCode: deptCode,
          department: deptName,
          courseName,
          courseCode,
          courseDept,
          section: sec.name || '—',
          sectionName: sec.name || '—',
          sectionYear: sec.year || student.year || 1,
          year: sec.year || student.year || 1,
          subject: isOverall ? 'Overall (All Subjects)' : `${sub.name} (${sub.code})`,
          subjectId: isOverall ? null : subId,
          totalPeriods: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
        };
      }

      studentMap[key].totalPeriods += 1;
      if (rec.status === 'present') {
        studentMap[key].presentCount += 1;
      } else if (rec.status === 'late') {
        studentMap[key].lateCount += 1;
      } else if (rec.status === 'absent') {
        studentMap[key].absentCount += 1;
      }
    });
  });

  // Calculate percentages and filter defaulters
  const defaulters = [];

  Object.values(studentMap).forEach((item) => {
    if (item.totalPeriods === 0) return;
    const effectivePresent = item.presentCount + item.lateCount;
    const percentage = Number(((effectivePresent / item.totalPeriods) * 100).toFixed(1));

    if (percentage < threshold) {
      defaulters.push({
        studentId: item.studentId,
        name: item.name,
        rollNumber: item.rollNumber,
        department: item.department,
        departmentName: item.departmentName,
        departmentCode: item.departmentCode,
        courseName: item.courseName,
        courseCode: item.courseCode,
        courseDept: item.courseDept,
        section: item.section,
        sectionName: item.sectionName,
        year: item.sectionYear,
        subject: item.subject,
        totalPeriods: item.totalPeriods,
        totalSessions: item.totalPeriods,
        present: item.presentCount,
        presentCount: item.presentCount,
        late: item.lateCount,
        lateCount: item.lateCount,
        absent: item.absentCount,
        absentCount: item.absentCount,
        attended: effectivePresent,
        percentage,
        attendancePercentage: percentage,
      });
    }
  });

  // Sort ascending by percentage (worst attendance first)
  defaulters.sort((a, b) => a.percentage - b.percentage);

  // Compute stat summary strip
  const totalDefaulters = defaulters.length;
  let avgPercentage = 0;
  let worstPercentage = totalDefaulters > 0 ? defaulters[0].percentage : 0;
  let worstStudent = totalDefaulters > 0 ? `${defaulters[0].name} (${defaulters[0].rollNumber})` : 'None';

  if (totalDefaulters > 0) {
    const sumPct = defaulters.reduce((acc, curr) => acc + curr.percentage, 0);
    avgPercentage = Number((sumPct / totalDefaulters).toFixed(1));
  }

  return {
    month,
    threshold,
    mode: isOverall ? 'overall' : 'subject',
    defaulters,
    stats: {
      totalDefaulters,
      avgPercentage,
      worstPercentage,
      worstStudent,
    },
  };
}

module.exports = {
  calculateDefaulters,
};
