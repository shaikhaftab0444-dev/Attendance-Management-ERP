const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (dnsErr) {}
require('dotenv').config();

const User = require('./models/User');
const Course = require('./models/Course');
const Department = require('./models/Department');
const AcademicSession = require('./models/AcademicSession');
const Section = require('./models/Section');
const Subject = require('./models/Subject');
const TeacherSubject = require('./models/TeacherSubject');
const Student = require('./models/Student');
const Batch = require('./models/Batch');
const PeriodSlot = require('./models/PeriodSlot');
const Attendance = require('./models/Attendance');
const Setting = require('./models/Setting');
const { normalizeDate } = require('./utils/helpers');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendedge';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, {
        family: 4,
      });
    }
    console.log('MongoDB connected for seeding...');

    // Sync indexes to clean up obsolete single-field unique indexes (e.g. old code_1 on Department)
    try {
      await Course.syncIndexes();
      await Department.syncIndexes();
      await User.syncIndexes();
      console.log('MongoDB schema indexes synchronized.');
    } catch (idxErr) {
      console.warn('Index sync notice:', idxErr.message);
    }

    // 1. Check or create default Settings
    let setting = await Setting.findOne();
    if (!setting) {
      setting = await Setting.create({
        editWindowHours: Number(process.env.EDIT_WINDOW_HOURS || 24),
        attendanceThresholdPercent: Number(process.env.ATTENDANCE_THRESHOLD_PERCENT || 75),
        institutionName: 'AttendEdge Institute of Technology',
      });
      console.log('Default settings created.');
    }

    // 2. Check or create Admin account
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@attendedge.local').toLowerCase().trim();
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123456';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPass, salt);

      admin = await User.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash,
        role: 'admin',
        department: null,
        employeeId: 'ADM-001',
        phone: '+1 (555) 019-2831',
        isActive: true,
      });
      console.log(`Admin account created: ${adminEmail} (password: ${adminPass})`);
    }

    // Ensure default Courses exist
    let btech = await Course.findOne({ code: 'BTECH' });
    if (!btech) {
      btech = await Course.create({
        name: 'Bachelor of Technology',
        code: 'BTECH',
        durationYears: 4,
      });
      console.log('Default Course created: Bachelor of Technology (BTECH)');
    }

    let diploma = await Course.findOne({ code: 'DIPLOMA' });
    if (!diploma) {
      diploma = await Course.create({
        name: 'Diploma in Engineering',
        code: 'DIPLOMA',
        durationYears: 3,
      });
      console.log('Default Course created: Diploma in Engineering (DIPLOMA)');
    }

    // Migration Check: Check for any existing Departments missing a course
    const unassignedDepts = await Department.find({ $or: [{ course: { $exists: false } }, { course: null }] });
    if (unassignedDepts.length > 0) {
      console.warn(`\n⚠️ [MIGRATION WARNING] Found ${unassignedDepts.length} Department(s) missing an assigned Course:`);
      for (const d of unassignedDepts) {
        d.course = btech._id;
        await d.save();
        console.warn(`   --> Auto-assigned department '${d.name}' (${d.code}) to B.Tech.`);
      }
    }

    // Always run Year backfill for any existing records missing year
    await Section.updateMany(
      { $or: [{ year: { $exists: false } }, { year: null }] },
      [{ $set: { year: { $min: [4, { $max: [1, { $ceil: { $divide: ['$semester', 2] } }] }] } } }]
    );
    await Student.updateMany(
      { $or: [{ year: { $exists: false } }, { year: null }] },
      [{ $set: { year: { $min: [4, { $max: [1, { $ceil: { $divide: ['$semester', 2] } }] }] } } }]
    );
    await Subject.updateMany(
      { $or: [{ year: { $exists: false } }, { year: null }] },
      [{ $set: { year: { $min: [4, { $max: [1, { $ceil: { $divide: ['$semester', 2] } }] }] } } }]
    );

    // Migration Check: Check for any existing HOD users missing a Course or Year
    const unassignedHods = await User.find({
      role: 'hod',
      $or: [
        { year: { $exists: false } },
        { year: null },
        { course: { $exists: false } },
        { course: null }
      ]
    });
    if (unassignedHods.length > 0) {
      console.warn(`\n⚠️ [MIGRATION WARNING] Found ${unassignedHods.length} HOD user(s) missing an assigned Course/Year:`);
      for (const u of unassignedHods) {
        console.warn(`   - ${u.name} (${u.email}) [ID: ${u._id}]`);
        if (!u.course) u.course = btech._id;
        if (!u.year) u.year = 2;
        await u.save();
        console.warn(`   --> Auto-assigned HOD '${u.email}' to B.Tech Year ${u.year}.`);
      }
    }

    // Migration Check: Check for any existing Teacher users missing teachingYears
    const teachersMissingYears = await User.find({
      role: 'teacher',
      $or: [
        { teachingYears: { $exists: false } },
        { teachingYears: null },
        { teachingYears: { $size: 0 } },
      ],
    });
    if (teachersMissingYears.length > 0) {
      console.warn(`\n⚠️ [MIGRATION WARNING] Found ${teachersMissingYears.length} Teacher user(s) missing teachingYears:`);
      for (const t of teachersMissingYears) {
        const secIds = await TeacherSubject.find({ teacher: t._id }).distinct('section');
        const assignedSections = await Section.find({ _id: { $in: secIds } });
        const years = Array.from(new Set(assignedSections.map((s) => s.year).filter(Boolean))).sort((a, b) => a - b);
        t.teachingYears = years.length > 0 ? years : [1, 2, 3, 4];
        await t.save();
        console.warn(`   --> Initialized declared teachingYears for '${t.name}' to [${t.teachingYears.join(', ')}].`);
      }
    }

    // Ensure default Batches exist
    let batchBTech2024 = await Batch.findOne({ course: btech._id, name: '2024-2028' });
    if (!batchBTech2024) {
      batchBTech2024 = await Batch.create({
        name: '2024-2028',
        course: btech._id,
        startYear: 2024,
        endYear: 2028,
        isActive: true,
      });
      console.log('Default Batch created: B.Tech 2024-2028');
    }

    let batchBTech2023 = await Batch.findOne({ course: btech._id, name: '2023-2027' });
    if (!batchBTech2023) {
      batchBTech2023 = await Batch.create({
        name: '2023-2027',
        course: btech._id,
        startYear: 2023,
        endYear: 2027,
        isActive: true,
      });
      console.log('Default Batch created: B.Tech 2023-2027');
    }

    let batchDiploma2024 = await Batch.findOne({ course: diploma._id, name: '2024-2027' });
    if (!batchDiploma2024) {
      batchDiploma2024 = await Batch.create({
        name: '2024-2027',
        course: diploma._id,
        startYear: 2024,
        endYear: 2027,
        isActive: true,
      });
      console.log('Default Batch created: Diploma 2024-2027');
    }

    // Migration Check: Check for any existing Students missing a batch
    const studentsMissingBatch = await Student.find({
      $or: [{ batch: { $exists: false } }, { batch: null }],
    }).populate({ path: 'department', populate: { path: 'course' } });

    if (studentsMissingBatch.length > 0) {
      console.warn(`\n⚠️ [MIGRATION WARNING] Found ${studentsMissingBatch.length} Student(s) missing an assigned Batch:`);
      for (const st of studentsMissingBatch) {
        const isDiploma = st.department?.course?.code === 'DIPLOMA';
        if (isDiploma) {
          st.batch = batchDiploma2024._id;
        } else {
          st.batch = st.year === 1 ? batchBTech2024._id : batchBTech2023._id;
        }
        await st.save();
      }
      console.warn(`   --> Auto-assigned missing batches for ${studentsMissingBatch.length} student(s).`);
    }

    // Migration Check: Check for any existing Sections missing a batch
    const sectionsMissingBatch = await Section.find({
      $or: [{ batch: { $exists: false } }, { batch: null }],
    }).populate({ path: 'department', populate: { path: 'course' } });

    if (sectionsMissingBatch.length > 0) {
      console.warn(`\n⚠️ [MIGRATION WARNING] Found ${sectionsMissingBatch.length} Section(s) missing an assigned Batch:`);
      for (const sec of sectionsMissingBatch) {
        const isDiploma = sec.department?.course?.code === 'DIPLOMA';
        if (isDiploma) {
          sec.batch = batchDiploma2024._id;
        } else {
          sec.batch = sec.year === 1 ? batchBTech2024._id : batchBTech2023._id;
        }
        await sec.save();
      }
      console.warn(`   --> Auto-assigned missing batches for ${sectionsMissingBatch.length} section(s).`);
    }

    // Check if other entities exist; if already seeded, ensure attendance records exist
    const deptCount = await Department.countDocuments();
    if (deptCount > 0) {
      console.log('Database already has departments. Checking attendance records...');
      const attCount = await Attendance.countDocuments();
      if (attCount === 0) {
        const sections = await Section.find().populate('department');
        const teachers = await User.find({ role: 'teacher' });
        const session = await AcademicSession.findOne({ isActive: true }) || await AcademicSession.findOne();
        if (sections.length > 0 && teachers.length > 0 && session) {
          for (const sec of sections) {
            const students = await Student.find({ section: sec._id });
            if (students.length === 0) continue;
            const sub = await Subject.findOne({ department: sec.department._id, semester: sec.semester }) || await Subject.findOne({ department: sec.department._id }) || await Subject.findOne();
            const teacher = teachers[0];
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
            const now = new Date();
            const curYear = now.getFullYear();
            const curMonth = now.getMonth();
            for (let d = 1; d <= 12; d++) {
              const lectureDate = normalizeDate(new Date(curYear, curMonth, d));
              const records = students.map((st, idx) => {
                if (idx === 0) {
                  return { student: st._id, status: d <= 2 ? 'present' : 'absent' }; // ~16.7%
                } else if (idx === 1) {
                  return { student: st._id, status: d <= 5 ? 'present' : 'absent' }; // ~41.7%
                } else {
                  return { student: st._id, status: 'present' };
                }
              });
              await Attendance.create({
                date: lectureDate,
                periodSlot: slot._id,
                subject: sub?._id,
                section: sec._id,
                teacher: teacher._id,
                session: session._id,
                records,
                markedAt: new Date(lectureDate.getTime() + 10 * 3600 * 1000),
              });
            }
          }
          console.log('Sample attendance records created for active sections.');
        }
      }
      return;
    }

    console.log('Seeding initial academic records...');

    // 3. Departments
    const cseDept = await Department.create({ name: 'Computer Science & Engineering', code: 'CSE', course: btech._id });
    const eceDept = await Department.create({ name: 'Electronics & Communication', code: 'ECE', course: btech._id });
    const mechDept = await Department.create({ name: 'Mechanical Engineering', code: 'MECH', course: btech._id });

    // Diploma departments to showcase compound uniqueness (same 'CSE' code under different course)
    await Department.create({ name: 'Diploma Computer Engineering', code: 'CSE', course: diploma._id });
    await Department.create({ name: 'Diploma Mechanical Engineering', code: 'MECH', course: diploma._id });

    // 4. Academic Session
    const currentYear = new Date().getFullYear();
    const session = await AcademicSession.create({
      year: `${currentYear}-${currentYear + 1}`,
      semesterLabel: 'Fall Semester',
      startDate: new Date(currentYear, 7, 1), // Aug 1
      endDate: new Date(currentYear, 11, 31), // Dec 31
      isActive: true,
    });

    // 5. Teachers and Course+Year-HODs
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash('Teacher@123456', salt);
    const hodHash = await bcrypt.hash('Hod@123456', salt);

    // Seed B.Tech 2nd Year HOD
    const hodCse = await User.create({
      name: 'Dr. Anand Ramanujan',
      email: 'hod.cse@attendedge.local',
      passwordHash: hodHash,
      role: 'hod',
      course: btech._id,
      year: 2, // B.Tech 2nd Year HOD
      employeeId: 'EMP-HOD-02',
      phone: '+1 (555) 301-4401',
      isActive: true,
    });

    // Seed B.Tech 1st Year HOD
    await User.create({
      name: 'Dr. S. K. Mukherjee',
      email: 'hod.y1@attendedge.local',
      passwordHash: hodHash,
      role: 'hod',
      course: btech._id,
      year: 1, // B.Tech 1st Year HOD
      employeeId: 'EMP-HOD-01',
      phone: '+1 (555) 301-4402',
      isActive: true,
    });

    const teacher1 = await User.create({
      name: 'Dr. Rajesh Sharma',
      email: 'prof.sharma@attendedge.local',
      passwordHash: defaultHash,
      role: 'teacher',
      department: cseDept._id,
      employeeId: 'EMP-TCH-101',
      phone: '+1 (555) 441-2011',
      isActive: true,
    });

    const teacher2 = await User.create({
      name: 'Prof. Anita Verma',
      email: 'prof.verma@attendedge.local',
      passwordHash: defaultHash,
      role: 'teacher',
      department: cseDept._id,
      employeeId: 'EMP-TCH-102',
      phone: '+1 (555) 441-2012',
      isActive: true,
    });

    const teacher3 = await User.create({
      name: 'Prof. Vikram Patel',
      email: 'prof.patel@attendedge.local',
      passwordHash: defaultHash,
      role: 'teacher',
      department: cseDept._id,
      employeeId: 'EMP-TCH-103',
      phone: '+1 (555) 441-2013',
      isActive: true,
    });

    // 6. Sections (with explicit Year)
    const secCSE4A = await Section.create({
      name: 'CSE-4A',
      department: cseDept._id,
      semester: 4,
      year: 2, // 2nd Year
      session: session._id,
    });

    const secCSE4B = await Section.create({
      name: 'CSE-4B',
      department: cseDept._id,
      semester: 4,
      year: 2, // 2nd Year
      session: session._id,
    });

    // 7. Subjects
    const subDSA = await Subject.create({
      name: 'Data Structures & Algorithms',
      code: 'CS401',
      department: cseDept._id,
      semester: 4,
      year: 2,
      credits: 4,
    });

    const subOS = await Subject.create({
      name: 'Operating Systems',
      code: 'CS402',
      department: cseDept._id,
      semester: 4,
      year: 2,
      credits: 3,
    });

    const subDBMS = await Subject.create({
      name: 'Database Management Systems',
      code: 'CS403',
      department: cseDept._id,
      semester: 4,
      year: 2,
      credits: 4,
    });

    const subCN = await Subject.create({
      name: 'Computer Networks',
      code: 'CS404',
      department: cseDept._id,
      semester: 4,
      year: 2,
      credits: 3,
    });

    // 8. TeacherSubject Assignments
    await TeacherSubject.create([
      { teacher: teacher1._id, subject: subDSA._id, section: secCSE4A._id, session: session._id },
      { teacher: teacher1._id, subject: subDSA._id, section: secCSE4B._id, session: session._id },
      { teacher: teacher2._id, subject: subOS._id, section: secCSE4A._id, session: session._id },
      { teacher: teacher2._id, subject: subDBMS._id, section: secCSE4B._id, session: session._id },
      { teacher: teacher3._id, subject: subCN._id, section: secCSE4A._id, session: session._id },
    ]);

    // 9. Students (with explicit Year 2)
    const studentNames = [
      'Aarav Kumar', 'Ananya Iyer', 'Rohan Gupta', 'Sneha Menon',
      'Kabir Roy', 'Diya Sen', 'Arjun Reddy', 'Pooja Nair',
      'Ishaan Joshi', 'Meera Rao', 'Aditya Mishra', 'Rhea Kapoor',
      'Vikram Saxena', 'Tanvi Desai', 'Siddharth Bose', 'Nisha Pillai',
      'Varun Malhotra', 'Kavya Singhania', 'Yash Chopra', 'Priya Nambiar'
    ];

    const students4A = [];
    for (let i = 0; i < studentNames.length; i++) {
      const roll = `23CSE0${i + 1 < 10 ? '0' + (i + 1) : i + 1}`;
      const s = await Student.create({
        name: studentNames[i],
        rollNumber: roll,
        section: secCSE4A._id,
        department: cseDept._id,
        semester: 4,
        year: 2,
        email: `${studentNames[i].toLowerCase().replace(' ', '.')}@attendedge.edu`,
        phone: `+1 (555) 789-${1000 + i}`,
        isActive: true,
      });
      students4A.push(s);
    }

    // 10. Period Slots (Timetable)
    const today = new Date().getDay();
    const daysToSeed = [1, 2, 3, 4, 5];
    if (!daysToSeed.includes(today)) {
      daysToSeed.push(today);
    }

    const createdSlots = [];
    for (const d of daysToSeed) {
      const slot1 = await PeriodSlot.create({
        section: secCSE4A._id,
        dayOfWeek: d,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        subject: subDSA._id,
        teacher: teacher1._id,
        session: session._id,
      });
      createdSlots.push(slot1);

      const slot2 = await PeriodSlot.create({
        section: secCSE4A._id,
        dayOfWeek: d,
        periodNumber: 2,
        startTime: '10:15',
        endTime: '11:15',
        subject: subOS._id,
        teacher: teacher2._id,
        session: session._id,
      });
      createdSlots.push(slot2);

      const slot3 = await PeriodSlot.create({
        section: secCSE4A._id,
        dayOfWeek: d,
        periodNumber: 3,
        startTime: '11:30',
        endTime: '12:30',
        subject: subCN._id,
        teacher: teacher3._id,
        session: session._id,
      });
      createdSlots.push(slot3);
    }

    // 11. Past Attendance Records (Last 14 days)
    for (let i = 14; i >= 1; i--) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - i);
      const pastDayOfWeek = pastDate.getDay();
      const normDate = normalizeDate(pastDate);

      const slotForDay = createdSlots.find((s) => s.dayOfWeek === pastDayOfWeek && s.periodNumber === 1);
      if (slotForDay) {
        const records = students4A.map((st, idx) => {
          if (idx === 3 || idx === 7) {
            return {
              student: st._id,
              status: Math.random() > 0.65 ? 'present' : (Math.random() > 0.5 ? 'late' : 'absent'),
            };
          }
          const rand = Math.random();
          return {
            student: st._id,
            status: rand > 0.15 ? 'present' : (rand > 0.05 ? 'late' : 'absent'),
          };
        });

        await Attendance.create({
          date: normDate,
          periodSlot: slotForDay._id,
          subject: subDSA._id,
          section: secCSE4A._id,
          teacher: teacher1._id,
          session: session._id,
          records,
          markedAt: new Date(normDate.getTime() + 10 * 3600 * 1000),
        });
      }
    }

    console.log('Database seeded successfully with sample academic records!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

if (require.main === module) {
  seedDatabase().then(() => {
    mongoose.disconnect();
    process.exit(0);
  });
}

module.exports = seedDatabase;
