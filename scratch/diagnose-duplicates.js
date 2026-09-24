const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

require('./server/models/Course');
require('./server/models/Department');
require('./server/models/Section');
require('./server/models/Batch');
const Student = require('./server/models/Student');
const Batch = require('./server/models/Batch');

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const batches = await Batch.find().populate('course');
  console.log('\n--- BATCHES ---');
  for (const b of batches) {
    const studentCount = await Student.countDocuments({ batch: b._id });
    const activeStudentCount = await Student.countDocuments({ batch: b._id, isActive: true });
    console.log(`Batch: ${b.name} (${b.course?.code}) - Total Students: ${studentCount}, Active: ${activeStudentCount}`);
  }

  const allStudents = await Student.find()
    .populate('batch')
    .populate({ path: 'department', populate: { path: 'course' } })
    .populate('section')
    .sort({ createdAt: 1 });

  console.log(`\nTotal Students in Database: ${allStudents.length}`);

  // Group by (departmentId + rollNumber) and also by (batchId + rollNumber)
  const rollMap = new Map();
  allStudents.forEach(s => {
    const deptId = s.department?._id?.toString() || s.department?.toString() || 'none';
    const deptCode = s.department?.code || 'NO_DEPT';
    const batchName = s.batch?.name || 'NO_BATCH';
    const key = `${deptId}_${s.rollNumber}`;
    if (!rollMap.has(key)) {
      rollMap.set(key, {
        deptCode,
        rollNumber: s.rollNumber,
        batchName,
        students: [],
      });
    }
    rollMap.get(key).students.push(s);
  });

  console.log('\n--- DUPLICATE STUDENT GROUPS (Same Dept + RollNumber) ---');
  let duplicateCount = 0;
  for (const [key, group] of rollMap.entries()) {
    if (group.students.length > 1) {
      duplicateCount++;
      console.log(`\n[Group ${duplicateCount}] Dept: ${group.deptCode} | RollNumber: '${group.rollNumber}' | Total Copies: ${group.students.length}`);
      group.students.forEach((s, idx) => {
        console.log(`  Copy ${idx + 1}: ID=${s._id} | Name='${s.name}' | Email='${s.email}' | Phone='${s.phone}' | Batch='${s.batch?.name}' | Sec='${s.section?.name}' | CreatedAt=${s.createdAt?.toISOString()}`);
      });
    }
  }

  if (duplicateCount === 0) {
    console.log('No duplicate groups found by (Dept + RollNumber).');
  }

  process.exit(0);
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
