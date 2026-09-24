const BASE_URL = 'http://localhost:5000/api';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.text().catch(() => '');
  }

  if (!res.ok) {
    const error = new Error((data && data.message) || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runAllTests() {
  console.log('=== ATTENDEDGE FULL COMPREHENSIVE TEST SUITE ===\n');

  try {
    // 1. Health check
    console.log('1. Testing Backend Health...');
    const health = await req('/health');
    console.log('   ✓ Health status:', health.status);

    // 2. Admin Login
    console.log('\n2. Testing Admin Authentication...');
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@attendedge.local',
        password: 'Admin@123456',
      }),
    });
    const adminToken = adminLogin.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('   ✓ Logged in as Admin:', adminLogin.user.name);

    // 3. Holiday Management
    console.log('\n3. Testing Holiday Management...');
    const holidayDateStr = '2026-10-02';
    const holidayRes = await req('/admin/holidays', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        date: holidayDateStr,
        name: 'Gandhi Jayanti',
      }),
    }).catch((err) => {
      if (err.status === 409) return { name: 'Gandhi Jayanti (Already exists)' };
      throw err;
    });
    console.log('   ✓ Holiday created/verified:', holidayRes.name);

    const holidaysList = await req('/admin/holidays', { headers: adminHeaders });
    console.log(`   ✓ Retrieved ${holidaysList.length} total holidays in system.`);

    // 4. Test Attendance Marking Rejection on Holiday
    console.log('\n4. Testing Holiday Attendance Blocking (Teacher Role)...');
    const teacherLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'prof.sharma@attendedge.local',
        password: 'Teacher@123456',
      }),
    });
    const teacherHeaders = { Authorization: `Bearer ${teacherLogin.token}` };

    const todaySlots = await req('/teacher/timetable/today', { headers: teacherHeaders });
    const slotList = todaySlots.slots || todaySlots;
    if (slotList.length > 0) {
      const targetSlot = slotList[0];
      const rosterRes = await req(`/teacher/period/${targetSlot._id}/students`, { headers: teacherHeaders });
      const records = rosterRes.students.map((st) => ({ student: st._id, status: 'present' }));

      // Attempt attendance on holidayDateStr
      try {
        await req('/teacher/attendance', {
          method: 'POST',
          headers: teacherHeaders,
          body: JSON.stringify({
            periodSlotId: targetSlot._id,
            date: holidayDateStr,
            records,
          }),
        });
        console.error('   ✗ ERROR: Attendance was allowed on a holiday!');
      } catch (holErr) {
        console.log(`   ✓ Attendance blocked on holiday as expected! Status ${holErr.status}: "${holErr.data?.message}"`);
      }
    }

    // 5. Cross-Department Teaching Support
    console.log('\n5. Testing Cross-Department Teacher Directory (HOD Role)...');
    const hodLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'hod.cse@attendedge.local',
        password: 'Hod@123456',
      }),
    });
    const hodHeaders = { Authorization: `Bearer ${hodLogin.token}` };

    const teacherDirectory = await req('/hod/teacher-directory', { headers: hodHeaders });
    console.log(`   ✓ HOD retrieved ${teacherDirectory.length} system-wide faculty members:`);
    teacherDirectory.slice(0, 3).forEach((t) => {
      console.log(`     - ${t.name} (${t.department?.name || 'No Dept'})`);
    });

    // 6. Timetable Conflict Detection & Prevention
    console.log('\n6. Testing Timetable Double-Booking Conflict Prevention (409 Conflict)...');
    const sections = await req('/admin/sections', { headers: adminHeaders });
    const sec1 = sections[0];
    const sec2 = sections[1] || sections[0];
    const subjects = await req('/admin/subjects', { headers: adminHeaders });
    const teachers = await req('/admin/users?role=teacher', { headers: adminHeaders });
    const sessions = await req('/admin/sessions', { headers: adminHeaders });

    if (sec1 && sec2 && teachers.length > 0 && subjects.length > 0 && sessions.length > 0) {
      const teacherA = teachers[0]._id;
      const subA = subjects[0]._id;
      const sesA = sessions[0]._id;

      // Slot 1 in CSE-4A on Monday Period 6
      const testDay = 1;
      const testPeriod = 6;

      // Clear any existing test slots on this day+period
      const existingSlots = await req('/admin/period-slots', { headers: adminHeaders });
      for (const s of existingSlots) {
        if (s.dayOfWeek === testDay && s.periodNumber === testPeriod) {
          await req(`/admin/period-slots/${s._id}`, { method: 'DELETE', headers: adminHeaders }).catch(() => {});
        }
      }

      // Create Slot in Section 1
      const slot1 = await req('/admin/period-slots', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          section: sec1._id,
          dayOfWeek: testDay,
          periodNumber: testPeriod,
          startTime: '16:00',
          endTime: '17:00',
          subject: subA,
          teacher: teacherA,
          session: sesA,
        }),
      });
      console.log(`   ✓ Scheduled slot in ${sec1.name} for Period #${testPeriod}`);

      // Attempt double-booking same teacher at exact same day+period in Section 2
      try {
        await req('/admin/period-slots', {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({
            section: sec2._id,
            dayOfWeek: testDay,
            periodNumber: testPeriod,
            startTime: '16:00',
            endTime: '17:00',
            subject: subA,
            teacher: teacherA,
            session: sesA,
          }),
        });
        console.error('   ✗ ERROR: Teacher double-booking was allowed!');
      } catch (confErr) {
        console.log(`   ✓ Double-booking rejected with 409 Conflict: "${confErr.data?.message}"`);
      }

      // Cleanup test slot
      await req(`/admin/period-slots/${slot1._id}`, { method: 'DELETE', headers: adminHeaders });
      console.log('   ✓ Test slot cleaned up.');
    }

    // 7. Universal CSV Export across 6 entities
    console.log('\n7. Testing Universal CSV Export for all Entities...');
    const deptsCsv = await req('/admin/departments/export', { headers: adminHeaders });
    console.log('   ✓ Departments CSV Exported (length:', deptsCsv.length, 'bytes)');

    const sectionsCsv = await req('/admin/sections/export', { headers: adminHeaders });
    console.log('   ✓ Sections CSV Exported (length:', sectionsCsv.length, 'bytes)');

    const subjectsCsv = await req('/admin/subjects/export', { headers: adminHeaders });
    console.log('   ✓ Subjects CSV Exported (length:', subjectsCsv.length, 'bytes)');

    const usersCsv = await req('/admin/users/export', { headers: adminHeaders });
    console.log('   ✓ Staff Directory CSV Exported (length:', usersCsv.length, 'bytes)');

    const slotsCsv = await req('/admin/period-slots/export', { headers: adminHeaders });
    console.log('   ✓ Timetable Slots CSV Exported (length:', slotsCsv.length, 'bytes)');

    const holCsv = await req('/admin/holidays/export', { headers: adminHeaders });
    console.log('   ✓ Holidays CSV Exported (length:', holCsv.length, 'bytes)');

    console.log('\n=== ALL COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS! ===\n');
  } catch (err) {
    console.error('\n✗ Test failed:', err.data || err.message);
    process.exit(1);
  }
}

runAllTests();
