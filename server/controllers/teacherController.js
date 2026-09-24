const PeriodSlot = require('../models/PeriodSlot');
const TeacherSubject = require('../models/TeacherSubject');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Setting = require('../models/Setting');
const { calculateAttendancePercentage, normalizeDate } = require('../utils/helpers');
const { calculateDefaulters } = require('../utils/defaulterAggregation');
const { isHoliday } = require('../utils/isHoliday');
const { generatePdf } = require('../utils/pdf');
const { buildGenericTablePdfHtml } = require('../utils/pdfTemplate');

// GET /api/teacher/timetable/today
const getTodayTimetable = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const todayNormalized = normalizeDate(now);

    const slots = await PeriodSlot.find({ teacher: teacherId, dayOfWeek, isRecess: { $ne: true } })
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code course' },
      })
      .populate('subject', 'name code credits')
      .populate('session', 'year semesterLabel isActive')
      .sort({ periodNumber: 1 });

    const enrichedSlots = await Promise.all(
      slots.map(async (slot) => {
        const holidayCheck = await isHoliday(todayNormalized, slot.section?.department);
        const attendance = await Attendance.findOne({
          periodSlot: slot._id,
          date: todayNormalized,
        }).populate('records.student', 'name rollNumber');

        const studentCount = await Student.countDocuments({
          section: slot.section._id,
          isActive: true,
        });

        const settings = await Setting.findOne();
        const editWindowHours = settings?.editWindowHours || 24;

        let canEdit = false;
        if (attendance) {
          const hoursElapsed = (Date.now() - new Date(attendance.markedAt).getTime()) / (1000 * 60 * 60);
          canEdit = hoursElapsed <= editWindowHours;
        }

        return {
          ...slot.toObject(),
          studentCount,
          isHoliday: holidayCheck.isHoliday,
          holidayName: holidayCheck.holiday?.name || null,
          isMarked: !!attendance,
          attendanceId: attendance?._id || null,
          markedAt: attendance?.markedAt || null,
          lastEditedAt: attendance?.lastEditedAt || null,
          canEdit,
          stats: attendance ? {
            present: attendance.records.filter((r) => r.status === 'present').length,
            late: attendance.records.filter((r) => r.status === 'late').length,
            absent: attendance.records.filter((r) => r.status === 'absent').length,
          } : null,
        };
      })
    );

    // If today has global holiday, include flag in response
    const globalHolidayCheck = await isHoliday(todayNormalized);
    if (globalHolidayCheck.isHoliday) {
      return res.status(200).json({
        isHoliday: true,
        holidayName: globalHolidayCheck.holiday.name,
        slots: enrichedSlots,
      });
    }

    return res.status(200).json(enrichedSlots);
  } catch (error) {
    console.error('getTodayTimetable error:', error);
    return res.status(500).json({ message: 'Error fetching today timetable', error: error.message });
  }
};

// GET /api/teacher/timetable/weekly
const getWeeklyTimetable = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const slots = await PeriodSlot.find({ teacher: teacherId })
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('subject', 'name code')
      .populate('session', 'year semesterLabel')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    return res.status(200).json(slots);
  } catch (error) {
    console.error('getWeeklyTimetable error:', error);
    return res.status(500).json({ message: 'Error fetching weekly timetable' });
  }
};

// GET /api/teacher/subjects
const getMySubjects = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const assignments = await TeacherSubject.find({ teacher: teacherId })
      .populate('subject', 'name code semester credits')
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('session', 'year semesterLabel isActive');

    return res.status(200).json(assignments);
  } catch (error) {
    console.error('getMySubjects error:', error);
    return res.status(500).json({ message: 'Error fetching teacher subjects' });
  }
};

// GET /api/teacher/period/:periodSlotId/students
const getPeriodRoster = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { periodSlotId } = req.params;
    const { date } = req.query;

    const slot = await PeriodSlot.findById(periodSlotId)
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code course' },
      })
      .populate('subject', 'name code')
      .populate('session', 'year semesterLabel');

    if (!slot) {
      return res.status(404).json({ message: 'Period slot not found.' });
    }

    if (slot.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Forbidden. You are not the assigned teacher for this slot.' });
    }

    const targetDate = date ? normalizeDate(date) : normalizeDate(new Date());

    // Check if target date is a holiday for this slot's department
    const holidayCheck = await isHoliday(targetDate, slot.section?.department);

    const students = await Student.find({ section: slot.section._id, isActive: true })
      .sort({ rollNumber: 1 });

    const existingAttendance = await Attendance.findOne({
      periodSlot: slot._id,
      date: targetDate,
    });

    const settings = await Setting.findOne();
    const editWindowHours = settings?.editWindowHours || 24;

    let canEdit = true;
    if (existingAttendance) {
      const hoursElapsed = (Date.now() - new Date(existingAttendance.markedAt).getTime()) / (1000 * 60 * 60);
      canEdit = hoursElapsed <= editWindowHours;
    }

    return res.status(200).json({
      slot,
      students,
      isHoliday: holidayCheck.isHoliday,
      holidayName: holidayCheck.holiday?.name || null,
      isMarked: !!existingAttendance,
      attendance: existingAttendance,
      canEdit,
      editWindowHours,
    });
  } catch (error) {
    console.error('getPeriodRoster error:', error);
    return res.status(500).json({ message: 'Error fetching period roster', error: error.message });
  }
};

// POST /api/teacher/attendance
const markAttendance = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { periodSlotId, date, records } = req.body;

    if (!periodSlotId || !records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Period slot ID and student attendance records are required.' });
    }

    const normalizedDay = date ? normalizeDate(date) : normalizeDate(new Date());

    const slot = await PeriodSlot.findById(periodSlotId).populate({
      path: 'section',
      select: 'department',
      populate: { path: 'department', select: 'course' },
    });
    if (!slot) {
      return res.status(404).json({ message: 'Period slot not found.' });
    }

    if (slot.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Forbidden. You are not authorized to mark attendance for this period.' });
    }

    // 1. Holiday Check: Block marking on configured holiday for this section's department
    const holidayCheck = await isHoliday(normalizedDay, slot.section?.department);
    if (holidayCheck.isHoliday) {
      const dateFormatted = new Date(holidayCheck.holiday.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      return res.status(400).json({
        message: `Cannot mark attendance on ${holidayCheck.holiday.name} (${dateFormatted})`,
      });
    }

    const existing = await Attendance.findOne({
      periodSlot: slot._id,
      date: normalizedDay,
    });

    if (existing) {
      return res.status(409).json({
        message: 'Attendance has already been submitted for this period and date. Use edit mode if within edit window.',
        attendanceId: existing._id,
      });
    }

    const sectionStudents = await Student.find({ section: slot.section, isActive: true });
    const sectionStudentIds = new Set(sectionStudents.map((s) => s._id.toString()));

    if (records.length !== sectionStudents.length) {
      return res.status(400).json({
        message: `Incomplete record set. Section has ${sectionStudents.length} active students, but ${records.length} records were provided.`,
      });
    }

    for (const r of records) {
      if (!sectionStudentIds.has(r.student?.toString())) {
        return res.status(400).json({ message: `Student ID ${r.student} is not in this class section.` });
      }
      if (!['present', 'absent', 'late'].includes(r.status)) {
        return res.status(400).json({ message: `Invalid status '${r.status}' for student ${r.student}.` });
      }
    }

    const attendance = new Attendance({
      date: normalizedDay,
      periodSlot: slot._id,
      subject: slot.subject,
      section: slot.section,
      teacher: teacherId,
      session: slot.session,
      records: records.map((r) => ({
        student: r.student,
        status: r.status,
      })),
      markedAt: new Date(),
    });

    await attendance.save();

    return res.status(201).json({
      message: 'Attendance recorded successfully.',
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Duplicate attendance record detected for this period and date.' });
    }
    console.error('markAttendance error:', error);
    return res.status(500).json({ message: 'Error marking attendance', error: error.message });
  }
};

// PATCH /api/teacher/attendance/:id
const updateAttendance = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { id } = req.params;
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Student attendance records are required.' });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }

    if (attendance.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Forbidden. You are not the teacher who created this record.' });
    }

    const settings = await Setting.findOne();
    const editWindowHours = settings?.editWindowHours || 24;
    const hoursElapsed = (Date.now() - new Date(attendance.markedAt).getTime()) / (1000 * 60 * 60);

    if (hoursElapsed > editWindowHours) {
      return res.status(403).json({
        message: `Attendance edit window of ${editWindowHours} hours has expired. Marked at ${new Date(attendance.markedAt).toLocaleString()}.`,
      });
    }

    for (const r of records) {
      if (!['present', 'absent', 'late'].includes(r.status)) {
        return res.status(400).json({ message: `Invalid status '${r.status}' for student ${r.student}.` });
      }
    }

    attendance.records = records.map((r) => ({
      student: r.student,
      status: r.status,
    }));
    attendance.lastEditedAt = new Date();

    await attendance.save();

    return res.status(200).json({
      message: 'Attendance updated successfully.',
      attendance,
    });
  } catch (error) {
    console.error('updateAttendance error:', error);
    return res.status(500).json({ message: 'Error updating attendance', error: error.message });
  }
};

// GET /api/teacher/reports/my-subjects
const getMyReports = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { year } = req.query;

    const [assignments, attendances, settings] = await Promise.all([
      TeacherSubject.find({ teacher: teacherId })
        .populate('subject', 'name code semester credits')
        .populate({
          path: 'section',
          select: 'name semester year department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('session', 'year semesterLabel isActive'),
      Attendance.find({ teacher: teacherId })
        .populate('subject', 'name code')
        .populate({
          path: 'section',
          select: 'name semester year department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('records.student', 'name rollNumber year')
        .sort({ date: -1 }),
      Setting.findOne(),
    ]);

    const filteredAssignments = year
      ? assignments.filter((a) => Number(a.section?.year) === Number(year))
      : assignments;

    const filteredAttendances = year
      ? attendances.filter((att) => Number(att.section?.year) === Number(year))
      : attendances;

    let totalClasses = filteredAttendances.length;
    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;

    const subjectSectionStats = {};
    filteredAssignments.forEach((a) => {
      const key = `${a.subject?._id?.toString()}_${a.section?._id?.toString()}`;
      subjectSectionStats[key] = {
        subject: a.subject,
        section: a.section,
        session: a.session,
        totalPeriodsHeld: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
      };
    });

    filteredAttendances.forEach((att) => {
      const key = `${att.subject?._id?.toString()}_${att.section?._id?.toString()}`;
      let p = 0, l = 0, a = 0;

      att.records.forEach((r) => {
        if (r.status === 'present') { p++; totalPresent++; }
        else if (r.status === 'late') { l++; totalLate++; }
        else if (r.status === 'absent') { a++; totalAbsent++; }
      });

      if (subjectSectionStats[key]) {
        subjectSectionStats[key].totalPeriodsHeld += 1;
        subjectSectionStats[key].presentCount += p;
        subjectSectionStats[key].lateCount += l;
        subjectSectionStats[key].absentCount += a;
      }
    });

    const breakdown = Object.values(subjectSectionStats).map((item) => ({
      ...item,
      attendancePercentage: calculateAttendancePercentage(item.presentCount, item.lateCount, item.absentCount),
    }));

    const overallPercentage = calculateAttendancePercentage(totalPresent, totalLate, totalAbsent);

    return res.status(200).json({
      summary: {
        totalClassesConducted: totalClasses,
        overallPercentage,
        totalPresent,
        totalLate,
        totalAbsent,
        thresholdPercent: settings?.attendanceThresholdPercent || 75,
      },
      breakdown,
      recentLogs: filteredAttendances.slice(0, 15),
    });
  } catch (error) {
    console.error('getMyReports error:', error);
    return res.status(500).json({ message: 'Error compiling teacher reports', error: error.message });
  }
};

// GET /api/teacher/defaulters
const getTeacherDefaulters = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const { subject, month } = req.query;

    if (!subject) {
      return res.status(400).json({ message: 'Subject query parameter is required.' });
    }
    if (!month) {
      return res.status(400).json({ message: 'Month query parameter in YYYY-MM format is required.' });
    }

    const assignment = await TeacherSubject.findOne({ teacher: teacherId, subject });
    if (!assignment) {
      return res.status(403).json({ message: 'Forbidden. You are not assigned to teach this subject.' });
    }

    const teacherAssignments = await TeacherSubject.find({ teacher: teacherId, subject }).select('section');
    const sectionIds = teacherAssignments.map((a) => a.section);

    const data = await calculateDefaulters({
      month,
      subjectId: subject,
      mode: 'subject',
    });

    const studentsInSections = await Student.find({ section: { $in: sectionIds } }).select('_id');
    const studentIdSet = new Set(studentsInSections.map((s) => s._id.toString()));

    data.defaulters = data.defaulters.filter((d) => studentIdSet.has(d.studentId));
    data.stats.totalDefaulters = data.defaulters.length;
    if (data.defaulters.length > 0) {
      const sumPct = data.defaulters.reduce((acc, curr) => acc + curr.percentage, 0);
      data.stats.avgPercentage = Number((sumPct / data.defaulters.length).toFixed(1));
      data.stats.worstPercentage = data.defaulters[0].percentage;
      data.stats.worstStudent = `${data.defaulters[0].name} (${data.defaulters[0].rollNumber})`;
    } else {
      data.stats.avgPercentage = 0;
      data.stats.worstPercentage = 0;
      data.stats.worstStudent = 'None';
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('getTeacherDefaulters error:', error);
    return res.status(500).json({ message: error.message || 'Error calculating teacher defaulters' });
  }
};

// GET /api/teacher/reports/export-pdf
const exportTeacherReportsPdf = async (req, res) => {
  try {
    const teacher = req.user;
    const teacherId = req.user._id;
    const { year } = req.query;

    const [assignments, attendances] = await Promise.all([
      TeacherSubject.find({ teacher: teacherId })
        .populate('subject', 'name code semester credits')
        .populate({
          path: 'section',
          select: 'name semester year department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('session', 'year semesterLabel isActive'),
      Attendance.find({ teacher: teacherId })
        .populate('subject', 'name code')
        .populate({
          path: 'section',
          select: 'name semester year department',
          populate: { path: 'department', select: 'name code' },
        })
        .populate('records.student', 'name rollNumber year')
        .sort({ date: -1 }),
    ]);

    const filteredAssignments = year
      ? assignments.filter((a) => Number(a.section?.year) === Number(year))
      : assignments;

    const filteredAttendances = year
      ? attendances.filter((att) => Number(att.section?.year) === Number(year))
      : attendances;

    const subjectSectionStats = {};
    filteredAssignments.forEach((a) => {
      const key = `${a.subject?._id?.toString()}_${a.section?._id?.toString()}`;
      subjectSectionStats[key] = {
        subject: a.subject,
        section: a.section,
        session: a.session,
        totalPeriodsHeld: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
      };
    });

    filteredAttendances.forEach((att) => {
      const key = `${att.subject?._id?.toString()}_${att.section?._id?.toString()}`;
      let p = 0, l = 0, a = 0;
      att.records.forEach((r) => {
        if (r.status === 'present') p++;
        else if (r.status === 'late') l++;
        else if (r.status === 'absent') a++;
      });
      if (subjectSectionStats[key]) {
        subjectSectionStats[key].totalPeriodsHeld += 1;
        subjectSectionStats[key].presentCount += p;
        subjectSectionStats[key].lateCount += l;
        subjectSectionStats[key].absentCount += a;
      }
    });

    const rows = Object.values(subjectSectionStats).map((item) => ({
      subject: item.subject ? `${item.subject.name} (${item.subject.code})` : '—',
      section: item.section?.name || '—',
      department: item.section?.department?.code || '—',
      year: item.section?.year ? `Year ${item.section.year}` : '—',
      sessionsHeld: item.totalPeriodsHeld,
      breakdown: `${item.presentCount}P / ${item.lateCount}L / ${item.absentCount}A`,
      percentage: `${calculateAttendancePercentage(item.presentCount, item.lateCount, item.absentCount)}%`,
    }));

    const html = buildGenericTablePdfHtml({
      title: 'Teaching Performance & Subject Attendance Report',
      subtitle: `Classroom attendance summary across assigned subjects for ${teacher.name}`,
      filters: {
        Faculty: `${teacher.name} (${teacher.employeeId || teacher.email})`,
        'Total Subjects/Sections': rows.length,
        'Total Lectures Conducted': filteredAttendances.length,
      },
      columns: [
        { header: 'Subject (Code)', key: 'subject' },
        { header: 'Dept / Section', render: (r) => `${r.department} · ${r.section}`, align: 'center' },
        { header: 'Year Level', key: 'year', align: 'center' },
        { header: 'Lectures Held', key: 'sessionsHeld', align: 'center' },
        { header: 'Turnout (P/L/A)', key: 'breakdown', align: 'center' },
        {
          header: 'Average Attendance',
          render: (r) => `<span class="badge badge-emerald font-bold">${r.percentage}</span>`,
          align: 'center',
        },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="my_teaching_reports.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportTeacherReportsPdf error:', err);
    return res.status(500).json({ message: 'Error generating teacher reports PDF', error: err.message });
  }
};

// GET /api/teacher/timetable/export-pdf
const exportTeacherTimetablePdf = async (req, res) => {
  try {
    const teacher = req.user;
    const teacherId = req.user._id;

    const slots = await PeriodSlot.find({ teacher: teacherId, isRecess: { $ne: true } })
      .populate({
        path: 'section',
        select: 'name semester year department',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('subject', 'name code')
      .populate('session', 'year semesterLabel')
      .sort({ dayOfWeek: 1, periodNumber: 1 });

    const INT_TO_DAY_NAME = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' };

    const rows = slots.map((s) => ({
      day: INT_TO_DAY_NAME[s.dayOfWeek] || `Day ${s.dayOfWeek}`,
      period: `Period #${s.periodNumber}`,
      timing: `${s.startTime} - ${s.endTime}`,
      subject: s.subject ? `${s.subject.name} (${s.subject.code})` : '—',
      section: s.section ? `${s.section.name} (${s.section.department?.code || 'Dept'})` : '—',
      year: s.section?.year ? `Year ${s.section.year}` : '—',
    }));

    const html = buildGenericTablePdfHtml({
      title: 'Weekly Teaching Schedule & Timetable',
      subtitle: `Personal weekly classroom lecture schedule for ${teacher.name}`,
      filters: {
        Faculty: `${teacher.name} (${teacher.employeeId || teacher.email})`,
        'Scheduled Lectures / Week': slots.length,
      },
      columns: [
        { header: 'Day of Week', key: 'day', align: 'center' },
        { header: 'Period', key: 'period', align: 'center' },
        { header: 'Timing', key: 'timing', align: 'center' },
        { header: 'Subject (Code)', key: 'subject' },
        { header: 'Class Section', key: 'section', align: 'center' },
        { header: 'Year Level', key: 'year', align: 'center' },
      ],
      rows,
    });

    const pdfBuffer = await generatePdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="teacher_weekly_schedule.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportTeacherTimetablePdf error:', err);
    return res.status(500).json({ message: 'Error generating teacher timetable PDF', error: err.message });
  }
};

// GET /api/teacher/defaulters/export-pdf
const exportTeacherDefaultersPdf = async (req, res) => {
  try {
    const teacher = req.user;
    const teacherId = req.user._id;
    let { subject, month } = req.query;

    if (!month) {
      month = new Date().toISOString().slice(0, 7);
    }

    let assignment = null;
    if (subject) {
      assignment = await TeacherSubject.findOne({ teacher: teacherId, subject }).populate('subject');
      if (!assignment) {
        return res.status(403).json({ message: 'Forbidden. You are not assigned to teach this subject.' });
      }
    } else {
      assignment = await TeacherSubject.findOne({ teacher: teacherId }).populate('subject');
      if (assignment) {
        subject = assignment.subject?._id?.toString() || assignment.subject?.toString();
      }
    }

    if (!assignment || !subject) {
      // Return empty report gracefully if teacher has no assigned subjects yet
      const html = buildGenericTablePdfHtml({
        title: `Subject Attendance Defaulters · ${month}`,
        subtitle: `No assigned subjects found for ${teacher.name}`,
        filters: {
          Faculty: `${teacher.name} (${teacher.employeeId || teacher.email})`,
          Month: month,
        },
        columns: [
          { header: 'Roll No', key: 'rollNumber', align: 'center' },
          { header: 'Student Name', key: 'name' },
          { header: 'Section', key: 'section', align: 'center' },
          { header: 'Attended / Total', key: 'attended', align: 'center' },
          { header: 'Attendance %', key: 'percentage', align: 'center' },
        ],
        rows: [],
      });
      const pdfBuffer = await generatePdf(html);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="defaulters_${month}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    const teacherAssignments = await TeacherSubject.find({ teacher: teacherId, subject }).select('section');
    const sectionIds = teacherAssignments.map((a) => a.section);

    const data = await calculateDefaulters({
      month,
      subjectId: subject,
      mode: 'subject',
    });

    const studentsInSections = await Student.find({ section: { $in: sectionIds } }).select('_id');
    const studentIdSet = new Set(studentsInSections.map((s) => s._id.toString()));

    const filteredDefaulters = (data.defaulters || []).filter((d) => studentIdSet.has(d.studentId));

    const rows = filteredDefaulters.map((d) => ({
      rollNumber: d.rollNumber || 'N/A',
      name: d.name || 'N/A',
      section: d.section || d.sectionName || 'N/A',
      attended: `${d.present != null ? d.present : (d.attended != null ? d.attended : 'N/A')} / ${d.totalPeriods != null ? d.totalPeriods : 'N/A'}`,
      percentage: `${d.percentage != null && !isNaN(d.percentage) ? d.percentage : 'N/A'}%`,
    }));

    const subjectName = assignment.subject?.name || 'Subject';
    const subjectCode = assignment.subject?.code || '';

    const html = buildGenericTablePdfHtml({
      title: `Subject Attendance Defaulters · ${month}`,
      subtitle: `Students falling below mandatory attendance threshold (${data.thresholdPercent || 75}%) in ${subjectName} (${subjectCode})`,
      filters: {
        Faculty: `${teacher.name} (${teacher.employeeId || teacher.email})`,
        Subject: `${subjectName} (${subjectCode})`,
        Month: month,
        Threshold: `${data.thresholdPercent || 75}%`,
      },
      columns: [
        { header: 'Roll No', key: 'rollNumber', align: 'center' },
        { header: 'Student Name', key: 'name' },
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
    res.setHeader('Content-Disposition', `attachment; filename="defaulters_${subjectCode}_${month}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error('exportTeacherDefaultersPdf error:', err);
    return res.status(500).json({ message: 'Error generating teacher defaulters PDF', error: err.message });
  }
};

module.exports = {
  getTodayTimetable,
  getWeeklyTimetable,
  getMySubjects,
  getPeriodRoster,
  markAttendance,
  updateAttendance,
  getMyReports,
  getTeacherDefaulters,
  exportTeacherReportsPdf,
  exportTeacherTimetablePdf,
  exportTeacherDefaultersPdf,
};
