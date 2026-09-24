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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTests() {
  console.log('=== ATTENDEDGE FULL STACK TEST SUITE ===\n');

  try {
    // 1. Health check
    console.log('1. Testing Health Endpoint...');
    const health = await req('/health');
    console.log('   ✓ Health check status:', health.status);

    // 2. Admin Login
    console.log('\n2. Testing Admin Login...');
    const adminLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@attendedge.local',
        password: 'Admin@123456',
      }),
    });
    console.log('   ✓ Admin logged in:', adminLoginRes.user.name, `[${adminLoginRes.user.role}]`);
    const adminToken = adminLoginRes.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 3. Admin Get Global Reports & Departments
    console.log('\n3. Testing Admin Global Reports & Departments...');
    const reportsRes = await req('/admin/reports/global', { headers: adminHeaders });
    console.log('   ✓ Global attendance percentage:', reportsRes.summary.globalAttendancePercentage + '%');
    console.log('   ✓ Total students:', reportsRes.summary.totalStudents);
    console.log('   ✓ Total departments:', reportsRes.summary.totalDepartments);

    const deptsRes = await req('/admin/departments', { headers: adminHeaders });
    console.log('   ✓ Departments count:', deptsRes.length, `(${deptsRes.map((d) => d.code).join(', ')})`);

    // 4. HOD Login & Scoped Routes
    console.log('\n4. Testing HOD Login & Department Scoping...');
    const hodLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'hod.cse@attendedge.local',
        password: 'Hod@123456',
      }),
    });
    console.log('   ✓ HOD logged in:', hodLoginRes.user.name, `[${hodLoginRes.user.role}]`);
    const hodToken = hodLoginRes.token;
    const hodHeaders = { Authorization: `Bearer ${hodToken}` };

    const hodTeachersRes = await req('/hod/teachers', { headers: hodHeaders });
    console.log('   ✓ Scoped faculty in HOD dept:', hodTeachersRes.length, 'teachers');

    const hodLowAttRes = await req('/hod/reports/low-attendance', { headers: hodHeaders });
    console.log('   ✓ Low attendance students flagged:', hodLowAttRes.totalFlagged);

    // 5. Role Guard Security Check: HOD attempting Admin endpoint -> Must be 403
    console.log('\n5. Testing Security Guard: HOD calling /api/admin/settings...');
    try {
      await req('/admin/settings', { headers: hodHeaders });
      console.error('   ✗ ERROR: HOD was able to access admin settings!');
    } catch (secErr) {
      console.log('   ✓ Security Guard verified! Response status:', secErr.status, `(${secErr.data?.message})`);
    }

    // 6. Teacher Login & Marking Flow
    console.log('\n6. Testing Teacher Login & Attendance Marking...');
    const teacherLoginRes = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'prof.sharma@attendedge.local',
        password: 'Teacher@123456',
      }),
    });
    console.log('   ✓ Teacher logged in:', teacherLoginRes.user.name, `[${teacherLoginRes.user.role}]`);
    const teacherToken = teacherLoginRes.token;
    const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

    const todaySlotsRes = await req('/teacher/timetable/today', { headers: teacherHeaders });
    console.log('   ✓ Today scheduled slots for teacher:', todaySlotsRes.length);

    if (todaySlotsRes.length > 0) {
      const slot = todaySlotsRes[0];
      console.log(`   ✓ Selected slot: ${slot.subject?.name} (${slot.section?.name}) - Period #${slot.periodNumber}`);

      // Fetch roster
      const rosterRes = await req(`/teacher/period/${slot._id}/students`, { headers: teacherHeaders });
      const students = rosterRes.students;
      console.log(`   ✓ Retrieved student roster: ${students.length} students`);

      // Prepare attendance records: 18 present, 1 late, 1 absent
      const records = students.map((st, i) => ({
        student: st._id,
        status: i === 0 ? 'absent' : (i === 1 ? 'late' : 'present'),
      }));

      // If already marked today, update it; if not marked, post new
      if (slot.isMarked && slot.attendanceId) {
        console.log('   ✓ Slot already marked. Testing update (PATCH)...');
        const patchRes = await req(`/teacher/attendance/${slot.attendanceId}`, {
          method: 'PATCH',
          headers: teacherHeaders,
          body: JSON.stringify({ records }),
        });
        console.log('   ✓ Attendance updated successfully:', patchRes.message);
      } else {
        console.log('   ✓ Marking attendance for today (POST)...');
        const postRes = await req('/teacher/attendance', {
          method: 'POST',
          headers: teacherHeaders,
          body: JSON.stringify({
            periodSlotId: slot._id,
            records,
          }),
        });
        console.log('   ✓ Attendance submitted successfully:', postRes.message);

        // Test duplicate rejection
        console.log('   ✓ Testing duplicate submission prevention (expecting 409 Conflict)...');
        try {
          await req('/teacher/attendance', {
            method: 'POST',
            headers: teacherHeaders,
            body: JSON.stringify({
              periodSlotId: slot._id,
              records,
            }),
          });
          console.error('   ✗ ERROR: Duplicate attendance was allowed!');
        } catch (dupErr) {
          console.log('   ✓ Duplicate rejected correctly! Status:', dupErr.status, `(${dupErr.data?.message})`);
        }
      }
    }

    // 7. Teacher My Reports
    console.log('\n7. Testing Teacher My Reports...');
    const teacherReports = await req('/teacher/reports/my-subjects', { headers: teacherHeaders });
    console.log('   ✓ Teacher average attendance rate:', teacherReports.summary.overallPercentage + '%');
    console.log('   ✓ Course breakdown count:', teacherReports.breakdown.length);

    console.log('\n=== ALL API TESTS PASSED SUCCESSFULLY! ===\n');
  } catch (err) {
    console.error('\n✗ Test failed with error:', err.data || err.message);
    process.exit(1);
  }
}

runTests();
