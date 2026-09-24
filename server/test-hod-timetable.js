const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Department = require('./models/Department');
const Section = require('./models/Section');
const Subject = require('./models/Subject');
const AcademicSession = require('./models/AcademicSession');
const PeriodSlot = require('./models/PeriodSlot');
const jwt = require('jsonwebtoken');

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'attendedge_super_secret_jwt_key_2026';

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendedge');
  console.log('--- TESTING HOD TIMETABLE AUTHORIZATION ---');

  // Find HOD CSE
  const hodUser = await User.findOne({ role: 'hod' }).populate('department');
  if (!hodUser) {
    console.error('No HOD found in DB');
    process.exit(1);
  }
  console.log(`Testing with HOD: ${hodUser.name}, Dept: ${hodUser.department.code}`);

  // Find Admin
  const adminUser = await User.findOne({ role: 'admin' });
  // Find Teacher
  const teacherUser = await User.findOne({ role: 'teacher' });

  const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret';
  // Generate tokens
  const hodToken = jwt.sign({ userId: hodUser._id, role: hodUser.role }, JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ userId: adminUser._id, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
  const teacherToken = jwt.sign({ userId: teacherUser._id, role: teacherUser.role }, JWT_SECRET, { expiresIn: '1h' });

  // Find active session
  const session = await AcademicSession.findOne({ isActive: true }) || await AcademicSession.findOne();

  // Find a CSE section (own department)
  const cseSection = await Section.findOne({ department: hodUser.department._id });
  // Find a non-CSE department and section (other department)
  let otherDept = await Department.findOne({ _id: { $ne: hodUser.department._id } });
  if (!otherDept) {
    otherDept = await Department.create({ name: 'Mechanical Eng', code: 'MECH' });
  }
  let otherSection = await Section.findOne({ department: otherDept._id });
  if (!otherSection) {
    otherSection = await Section.create({ name: 'MECH-1A', department: otherDept._id, semester: 1, year: 1, session: session._id });
  }

  // Find subject and teacher
  const subject = await Subject.findOne({ department: hodUser.department._id }) || await Subject.findOne();

  console.log(`CSE Section: ${cseSection?.name}, Other Dept (${otherDept?.code}) Section: ${otherSection?.name}`);

  // Clean up any test period slot at day 6 period 8
  await PeriodSlot.deleteMany({ dayOfWeek: 6, periodNumber: 8 });

  // TEST 1: Teacher tries to create period slot -> Expect 403
  const tRes = await fetch(`${API_BASE}/admin/period-slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${teacherToken}` },
    body: JSON.stringify({
      section: cseSection._id,
      dayOfWeek: 6,
      periodNumber: 8,
      startTime: '17:00',
      endTime: '18:00',
      subject: subject._id,
      teacher: teacherUser._id,
      session: session._id,
    })
  });
  console.log(`1. Teacher POST /api/admin/period-slots -> status: ${tRes.status} (Expected: 403)`);
  if (tRes.status !== 403) throw new Error(`Teacher should get 403, got ${tRes.status}`);

  // TEST 2: HOD tries to create period slot for OTHER department section -> Expect 403
  if (otherSection) {
    const hodOtherRes = await fetch(`${API_BASE}/admin/period-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hodToken}` },
      body: JSON.stringify({
        section: otherSection._id,
        dayOfWeek: 6,
        periodNumber: 8,
        startTime: '17:00',
        endTime: '18:00',
        subject: subject._id,
        teacher: teacherUser._id,
        session: session._id,
      })
    });
    console.log(`2. HOD POST /api/admin/period-slots (Other Dept Section) -> status: ${hodOtherRes.status} (Expected: 403)`);
    if (hodOtherRes.status !== 403) throw new Error(`HOD cross-department should get 403, got ${hodOtherRes.status}`);
  }

  // TEST 3: HOD creates period slot for OWN department section -> Expect 201
  const hodOwnRes = await fetch(`${API_BASE}/admin/period-slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hodToken}` },
    body: JSON.stringify({
      section: cseSection._id,
      dayOfWeek: 6,
      periodNumber: 8,
      startTime: '17:00',
      endTime: '18:00',
      subject: subject._id,
      teacher: teacherUser._id,
      session: session._id,
    })
  });
  console.log(`3. HOD POST /api/admin/period-slots (Own Dept Section) -> status: ${hodOwnRes.status} (Expected: 201)`);
  if (hodOwnRes.status !== 201) {
    const errText = await hodOwnRes.text();
    throw new Error(`HOD own dept should get 201, got ${hodOwnRes.status}: ${errText}`);
  }
  const createdSlot = await hodOwnRes.json();
  console.log(`   Created Slot ID: ${createdSlot._id}`);

  // TEST 4: HOD GET /api/admin/period-slots for own section -> Expect 200 with data
  const getRes = await fetch(`${API_BASE}/admin/period-slots?section=${cseSection._id}`, {
    headers: { 'Authorization': `Bearer ${hodToken}` }
  });
  console.log(`4. HOD GET /api/admin/period-slots -> status: ${getRes.status} (Expected: 200)`);
  const getSlots = await getRes.json();
  const found = getSlots.find(s => s._id === createdSlot._id);
  if (!found) throw new Error('Created slot not found in HOD GET response');
  console.log(`   Found slot in grid: ${found.subject?.name || found.subject}`);

  // TEST 5: HOD PATCH /api/admin/period-slots/:id -> Expect 200
  const patchRes = await fetch(`${API_BASE}/admin/period-slots/${createdSlot._id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hodToken}` },
    body: JSON.stringify({
      startTime: '17:15',
      endTime: '18:15',
    })
  });
  console.log(`5. HOD PATCH /api/admin/period-slots/:id -> status: ${patchRes.status} (Expected: 200)`);
  if (patchRes.status !== 200) {
    const errText = await patchRes.text();
    throw new Error(`HOD update should get 200, got ${patchRes.status}: ${errText}`);
  }

  // TEST 6: HOD DELETE /api/admin/period-slots/:id -> Expect 200
  const delRes = await fetch(`${API_BASE}/admin/period-slots/${createdSlot._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${hodToken}` }
  });
  console.log(`6. HOD DELETE /api/admin/period-slots/:id -> status: ${delRes.status} (Expected: 200)`);
  if (delRes.status !== 200) {
    const errText = await delRes.text();
    throw new Error(`HOD delete should get 200, got ${delRes.status}: ${errText}`);
  }

  // TEST 7: Admin regression test -> Admin POST and DELETE period slot
  const adminPostRes = await fetch(`${API_BASE}/admin/period-slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      section: cseSection._id,
      dayOfWeek: 6,
      periodNumber: 8,
      startTime: '17:00',
      endTime: '18:00',
      subject: subject._id,
      teacher: teacherUser._id,
      session: session._id,
    })
  });
  console.log(`7. Admin POST /api/admin/period-slots -> status: ${adminPostRes.status} (Expected: 201)`);
  if (adminPostRes.status !== 201) throw new Error(`Admin should get 201, got ${adminPostRes.status}`);
  const adminSlot = await adminPostRes.json();

  const adminDelRes = await fetch(`${API_BASE}/admin/period-slots/${adminSlot._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`8. Admin DELETE /api/admin/period-slots/:id -> status: ${adminDelRes.status} (Expected: 200)`);
  if (adminDelRes.status !== 200) throw new Error(`Admin delete should get 200, got ${adminDelRes.status}`);

  console.log('\n ALL HOD TIMETABLE AUTHORIZATION TESTS PASSED SUCCESSFULLY! ');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
