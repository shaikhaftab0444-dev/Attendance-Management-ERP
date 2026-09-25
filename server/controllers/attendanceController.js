const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Setting = require('../models/Setting');
const Department = require('../models/Department');

const condoneStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { reason, targetPercentage } = req.body;

    const student = await Student.findById(studentId).populate('department').populate('section');
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // RBAC check for HOD: ensure student is in HOD's year and course
    if (req.user.role === 'hod') {
      if (Number(student.year) !== Number(req.user.year)) {
        return res.status(403).json({
          message: `Access denied. Student is in Year ${student.year}, but you are the HOD for Year ${req.user.year}.`,
        });
      }
      if (req.user.course) {
        const studentDept = student.department?._id || student.department;
        const depts = await Department.find({ course: req.user.course }).select('_id');
        const deptIds = depts.map((d) => d._id.toString());
        if (!deptIds.includes(studentDept.toString())) {
          return res.status(403).json({
            message: 'Access denied. Student does not belong to your assigned Course.',
          });
        }
      }
    }

    // Fetch system threshold
    const setting = await Setting.findOne();
    const thresholdPercent = targetPercentage ? Number(targetPercentage) : (setting?.attendanceThresholdPercent || 75);

    // Calculate total periods and attended periods across all recorded sessions for this student
    const attendances = await Attendance.find({ 'records.student': student._id });
    let totalPeriods = 0;
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    attendances.forEach((att) => {
      const rec = att.records.find((r) => r.student && r.student.toString() === student._id.toString());
      if (rec) {
        totalPeriods += 1;
        if (rec.status === 'present') presentCount += 1;
        else if (rec.status === 'late') lateCount += 1;
        else if (rec.status === 'absent') absentCount += 1;
      }
    });

    const attendedCount = presentCount + lateCount;
    // Calculate required attendance to meet threshold
    const requiredAttended = Math.ceil((thresholdPercent / 100) * totalPeriods);
    const existingCondoned = student.condonedPeriods || 0;
    const currentEffective = attendedCount + existingCondoned;
    const periodsNeeded = Math.max(0, requiredAttended - currentEffective);

    // New total condoned periods
    const newCondoned = existingCondoned + (periodsNeeded > 0 ? periodsNeeded : 1);
    student.condonedPeriods = newCondoned;
    student.condonationReason = (reason || 'Medical Leave / Institutional Duty').trim();
    student.condonedBy = req.user._id;
    student.condonedAt = new Date();

    await student.save();

    const newEffectiveAttended = Math.min(totalPeriods, attendedCount + newCondoned);
    const newPercentage = totalPeriods > 0 ? Number(((newEffectiveAttended / totalPeriods) * 100).toFixed(1)) : 100;

    return res.status(200).json({
      message: `Attendance waiver granted for ${student.name} (${student.rollNumber}). Condoned ${periodsNeeded > 0 ? periodsNeeded : 1} period(s) under '${student.condonationReason}'. New effective attendance: ${newPercentage}%.`,
      student: {
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        condonedPeriods: student.condonedPeriods,
        condonationReason: student.condonationReason,
        condonedAt: student.condonedAt,
      },
      stats: {
        totalPeriods,
        rawAttended: attendedCount,
        condonedPeriods: student.condonedPeriods,
        effectivePercentage: newPercentage,
        thresholdPercent,
      },
    });
  } catch (error) {
    console.error('condoneStudent error:', error);
    return res.status(500).json({ message: 'Error granting attendance waiver', error: error.message });
  }
};

module.exports = {
  condoneStudent,
};
