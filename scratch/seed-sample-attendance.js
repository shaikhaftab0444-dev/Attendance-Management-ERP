const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

const User = require('./server/models/User');
const Course = require('./server/models/Course');
const Department = require('./server/models/Department');
const AcademicSession = require('./server/models/AcademicSession');
const Section = require('./server/models/Section');
const Subject = require('./server/models/Subject');
const Student = require('./server/models/Student');
const PeriodSlot = require('./server/models/PeriodSlot');
const Attendance = require('./server/models/Attendance');
const { normalizeDate } = require('./server/utils/helpers');

async function seedAttendance() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected for seeding attendance...');

  const session = await AcademicSession.findOne({ isActive: true }) || await AcademicSession.findOne();
  const sections = await Section.find().populate('department');
  const teachers = await User.find({ role: 'teacher' });

  if (sections.length === 0 || teachers.length === 0) {
    console.log('No sections or teachers found.');
    process.exit(1);
  }

  // Clear existing attendance records to ensure clean verification data
  await Attendance.deleteMany({});
  console.log('Cleared existing attendance records.');

  for (const sec of sections) {
    const students = await Student.find({ section: sec._id });
    if (students.length === 0) continue;

    // Find subjects for this department/year
    const subjects = await Subject.find({ department: sec.department._id, semester: sec.semester });
    const sub = subjects[0] || await Subject.findOne({ department: sec.department._id }) || await Subject.findOne();
    const teacher = teachers[0];

    // Create or find period slots
    let slot = await PeriodSlot.findOne({ section: sec._id });
    if (!slot) {
      slot = await PeriodSlot.create({
        section: sec._id,
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        subject: sub?._id,
        teacher: teacher._id,
        session: session._id,
      });
    }

    // Seed 10 lecture dates in September 2026
    for (let day = 1; day <= 10; day++) {
      const lectureDate = normalizeDate(new Date(2026, 8, day)); // 2026-09-01 to 2026-09-10

      const records = students.map((st, idx) => {
        // Make first 2 students in every section intentional defaulters (< 75% attendance)
        if (idx === 0) {
          // 20% attendance (2 present, 8 absent)
          return { student: st._id, status: day <= 2 ? 'present' : 'absent' };
        } else if (idx === 1) {
          // 40% attendance (4 present, 6 absent)
          return { student: st._id, status: day <= 4 ? 'present' : 'absent' };
        } else {
          // 90%-100% attendance
          return { student: st._id, status: 'present' };
        }
      });

      await Attendance.create({
        date: lectureDate,
        periodSlot: slot._id,
        subject: sub._id,
        section: sec._id,
        teacher: teacher._id,
        session: session._id,
        records,
        markedAt: new Date(lectureDate.getTime() + 10 * 3600 * 1000),
      });
    }
  }

  const count = await Attendance.countDocuments();
  console.log(`Successfully created ${count} attendance sessions for September 2026.`);
  process.exit(0);
}

seedAttendance().catch(err => {
  console.error('Error seeding attendance:', err);
  process.exit(1);
});
