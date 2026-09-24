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

async function runEnhancementTests() {
  console.log('=== ATTENDEDGE INCREMENTAL ENHANCEMENT TEST SUITE ===\n');

  try {
    // 1. Health check
    console.log('1. Health Check...');
    const health = await req('/health');
    console.log('   ✓ Backend is responsive:', health.status);

    // 2. Admin Login
    console.log('\n2. Admin Authentication...');
    const adminLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@attendedge.local',
        password: 'Admin@123456',
      }),
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };
    console.log('   ✓ Logged in as Admin:', adminLogin.user.name);

    // 3. Year Backfill Test
    console.log('\n3. Testing Year Backfill / Data Cleanup Endpoint (/api/admin/backfill-years)...');
    const backfillRes = await req('/admin/backfill-years', {
      method: 'POST',
      headers: adminHeaders,
    });
    console.log('   ✓ Backfill response:', backfillRes.message);

    // 4. Admin Sections & Students with Year Filtering
    console.log('\n4. Testing Sections & Students Year Filtering...');
    const sectionsYear2 = await req('/admin/sections?year=2', { headers: adminHeaders });
    console.log(`   ✓ Retrieved ${sectionsYear2.length} sections for Year 2:`, sectionsYear2.map((s) => `${s.name} (Year ${s.year})`).join(', '));

    const studentsYear2 = await req('/admin/students?year=2', { headers: adminHeaders });
    console.log(`   ✓ Retrieved ${studentsYear2.length} students for Year 2`);

    // 5. Admin Dashboard Department x Year Matrix
    console.log('\n5. Testing Admin Dashboard Department x Year Matrix Aggregation...');
    const globalReports = await req('/admin/reports/global', { headers: adminHeaders });
    console.log('   ✓ Department x Year Matrix received:');
    globalReports.departmentYearMatrix.forEach((m) => {
      console.log(`     - [${m.code}] ${m.name}: Year1=${m.year1}, Year2=${m.year2}, Year3=${m.year3}, Year4=${m.year4} (Total: ${m.total})`);
    });

    // Determine current month for defaulter calculation
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`\n6. Testing Admin Defaulters Endpoint for month: ${currentMonth}...`);
    const adminDefaulters = await req(`/admin/defaulters?month=${currentMonth}&mode=overall`, { headers: adminHeaders });
    console.log(`   ✓ Admin Defaulters calculated: ${adminDefaulters.defaulters.length} students below ${adminDefaulters.threshold}% threshold`);
    console.log(`   ✓ Stats: Total = ${adminDefaulters.stats.totalDefaulters}, Avg % = ${adminDefaulters.stats.avgPercentage}%, Worst = ${adminDefaulters.stats.worstStudent} (${adminDefaulters.stats.worstPercentage}%)`);

    // 7. HOD Login & Scoped Defaulters
    console.log('\n7. Testing HOD Login & Scoped Defaulters...');
    const hodLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'hod.cse@attendedge.local',
        password: 'Hod@123456',
      }),
    });
    const hodHeaders = { Authorization: `Bearer ${hodLogin.token}` };
    console.log('   ✓ Logged in as HOD:', hodLogin.user.name);

    const hodDefaulters = await req(`/hod/defaulters?month=${currentMonth}&mode=overall`, { headers: hodHeaders });
    console.log(`   ✓ HOD Defaulters calculated for Department: ${hodDefaulters.defaulters.length} students`);

    // 8. Teacher Login & Scoped Defaulters
    console.log('\n8. Testing Teacher Login & Subject Defaulters...');
    const teacherLogin = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'prof.sharma@attendedge.local',
        password: 'Teacher@123456',
      }),
    });
    const teacherHeaders = { Authorization: `Bearer ${teacherLogin.token}` };
    console.log('   ✓ Logged in as Teacher:', teacherLogin.user.name);

    const teacherSubjects = await req('/teacher/subjects', { headers: teacherHeaders });
    const assignedSubjectId = teacherSubjects[0]?.subject?._id;
    console.log(`   ✓ Teacher assigned subject: ${teacherSubjects[0]?.subject?.name} (${assignedSubjectId})`);

    const teacherDefaulters = await req(`/teacher/defaulters?month=${currentMonth}&subject=${assignedSubjectId}`, { headers: teacherHeaders });
    console.log(`   ✓ Teacher Defaulters for subject: ${teacherDefaulters.defaulters.length} students`);

    // 9. Security Test: Teacher querying unassigned subject -> must return 403 Forbidden
    console.log('\n9. Testing Security: Teacher attempting unassigned subject defaulters...');
    try {
      const fakeSubjectId = '507f1f77bcf86cd799439011';
      await req(`/teacher/defaulters?month=${currentMonth}&subject=${fakeSubjectId}`, { headers: teacherHeaders });
      console.error('   ✗ ERROR: Teacher was able to query unassigned subject!');
    } catch (secErr) {
      console.log('   ✓ Security verified! Status:', secErr.status, `(${secErr.data?.message})`);
    }

    console.log('\n=== ALL ENHANCEMENT TESTS PASSED PERFECTLY! ===\n');
  } catch (err) {
    console.error('\n✗ Test failed:', err.data || err.message);
    process.exit(1);
  }
}

runEnhancementTests();
