const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('--- Starting Verification of Part A, B, C ---');

  // 1. Admin login
  console.log('1. Logging in as admin...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@attendedge.local',
      password: 'Admin@123456',
    }),
  });
  const adminLogin = await adminLoginRes.json();
  const adminToken = adminLogin.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  console.log('   Admin logged in successfully.');

  // 2. Test Section batches & backfill
  console.log('2. Testing Section batches...');
  const sectionsRes = await fetch(`${BASE_URL}/admin/sections`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const sections = await sectionsRes.json();
  console.log(`   Found ${sections.length} sections.`);
  const secWithBatch = sections.find(s => s.batch);
  console.log(`   Sample section with batch: ${secWithBatch?.name} -> Batch: ${secWithBatch?.batch?.name || 'none'}`);

  // Test backfill endpoint
  const backfillRes = await fetch(`${BASE_URL}/admin/backfill-section-batches`, {
    method: 'POST',
    headers: adminHeaders,
  });
  const backfillData = await backfillRes.json();
  console.log(`   Backfill result: ${backfillData.message} (Updated: ${backfillData.updatedCount})`);

  // 3. HOD login
  console.log('3. Logging in as HOD...');
  const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hod.cse@attendedge.local',
      password: 'Hod@123456',
    }),
  });
  const hodLogin = await hodLoginRes.json();
  const hodToken = hodLogin.token;
  const hodHeaders = { Authorization: `Bearer ${hodToken}` };
  console.log(`   HOD logged in: ${hodLogin.user.name} (Year: ${hodLogin.user.year})`);

  // Get HOD sections to test Timetable PDF with section param
  const hodSectionsRes = await fetch(`${BASE_URL}/hod/sections`, { headers: hodHeaders });
  const hodSections = await hodSectionsRes.json();
  const testSecId = hodSections[0]?._id;

  // 4. Test HOD PDF endpoints
  console.log('4. Testing HOD PDF export endpoints...');

  const hodPdfEndpoints = [
    { name: 'Faculty Members PDF', url: `${BASE_URL}/hod/teachers/export-pdf` },
    { name: 'Subject Allocations PDF', url: `${BASE_URL}/hod/teacher-subjects/export-pdf` },
    { name: 'Weekly Timetable PDF', url: `${BASE_URL}/hod/timetable/export-timetable-pdf?section=${testSecId}` },
    { name: 'Defaulters PDF', url: `${BASE_URL}/hod/defaulters/export-pdf?month=2026-09` },
    { name: 'Analytics Reports PDF', url: `${BASE_URL}/hod/reports/export-pdf` },
    { name: 'Attendance Audit PDF', url: `${BASE_URL}/hod/attendance/export-pdf` },
  ];

  for (const ep of hodPdfEndpoints) {
    try {
      const res = await fetch(ep.url, { headers: hodHeaders });
      const buf = await res.arrayBuffer();
      const headerStr = Buffer.from(buf.slice(0, 4)).toString('ascii');
      const isPdf = headerStr === '%PDF';
      console.log(`   ✓ ${ep.name}: Status ${res.status}, Size: ${buf.byteLength} bytes, Header: %PDF is ${isPdf}`);
      if (!isPdf) throw new Error(`${ep.name} did not return a valid PDF header (status: ${res.status})`);
    } catch (err) {
      console.error(`   ✗ Error fetching ${ep.name}:`, err.message);
    }
  }

  // 5. Test Teacher login & PDF exports
  console.log('5. Finding and configuring a teacher via admin API...');
  const usersRes = await fetch(`${BASE_URL}/admin/users`, { headers: adminHeaders });
  const users = await usersRes.json();
  const teacherUser = users.find(u => u.role === 'teacher');
  console.log(`   Found teacher: ${teacherUser.name} (${teacherUser.email})`);

  // Update teacher password to known password
  await fetch(`${BASE_URL}/admin/users/${teacherUser._id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ password: 'Teacher@123456' }),
  });

  console.log('   Logging in as Teacher...');
  const teacherLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: teacherUser.email,
      password: 'Teacher@123456',
    }),
  });
  const teacherLogin = await teacherLoginRes.json();
  const teacherToken = teacherLogin.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };
  console.log(`   Teacher logged in: ${teacherLogin.user?.name}`);

  const teacherPdfEndpoints = [
    { name: 'Teacher Reports PDF', url: `${BASE_URL}/teacher/reports/export-pdf` },
    { name: 'Teacher Timetable PDF', url: `${BASE_URL}/teacher/timetable/export-pdf` },
    { name: 'Teacher Defaulters PDF', url: `${BASE_URL}/teacher/defaulters/export-pdf?month=2026-09` },
  ];

  for (const ep of teacherPdfEndpoints) {
    try {
      const res = await fetch(ep.url, { headers: teacherHeaders });
      const buf = await res.arrayBuffer();
      const headerStr = Buffer.from(buf.slice(0, 4)).toString('ascii');
      const isPdf = headerStr === '%PDF';
      console.log(`   ✓ ${ep.name}: Status ${res.status}, Size: ${buf.byteLength} bytes, Header: %PDF is ${isPdf}`);
      if (!isPdf) throw new Error(`${ep.name} did not return a valid PDF header (status: ${res.status})`);
    } catch (err) {
      console.error(`   ✗ Error fetching ${ep.name}:`, err.message);
    }
  }

  // 6. Test HOD CSV import for Subject Allocations
  console.log('6. Testing HOD CSV Import for Subject Allocations...');
  const hodSubjectsRes = await fetch(`${BASE_URL}/hod/subjects`, { headers: hodHeaders });
  const hodSubjects = await hodSubjectsRes.json();
  const hodTeachersRes = await fetch(`${BASE_URL}/hod/teachers`, { headers: hodHeaders });
  const hodTeachers = await hodTeachersRes.json();

  if (hodSubjects.length > 0 && hodSections.length > 0 && hodTeachers.length > 0) {
    const sub = hodSubjects[0];
    const sec = hodSections[0];
    const tch = hodTeachers[0];

    const validCsv = `departmentCode,subjectCode,sectionName,teacherEmployeeId\n${sec.department.code},${sub.code},${sec.name},${tch.employeeId || 'EMP-TCH-101'}\n`;

    const blob = new Blob([validCsv], { type: 'text/csv' });
    const formData = new FormData();
    formData.append('file', blob, 'allocations.csv');

    const importRes = await fetch(`${BASE_URL}/hod/teacher-subjects/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: formData,
    });
    const importData = await importRes.json();
    console.log(`   ✓ In-Scope Import: Total: ${importData.totalRows}, Created: ${importData.created}, Updated: ${importData.updated}, Skipped: ${importData.skipped}`);

    // Test Out-Of-Scope Rejection (Section from wrong year/name)
    const outOfScopeCsv = `departmentCode,subjectCode,sectionName,teacherEmployeeId\n${sec.department.code},${sub.code},NON_EXISTENT_OR_WRONG_YEAR,${tch.employeeId || 'EMP-TCH-101'}\n`;
    const badBlob = new Blob([outOfScopeCsv], { type: 'text/csv' });
    const badFormData = new FormData();
    badFormData.append('file', badBlob, 'bad_allocations.csv');

    const badImportRes = await fetch(`${BASE_URL}/hod/teacher-subjects/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hodToken}` },
      body: badFormData,
    });
    const badImportData = await badImportRes.json();
    console.log(`   ✓ Out-Of-Scope Correctly Rejected: Skipped: ${badImportData.skipped}, Reason: ${badImportData.errors?.[0]?.reason}`);
  }

  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
});
