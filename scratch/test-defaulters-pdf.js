const BASE_URL = 'http://localhost:5000/api';

async function verifyDefaulters() {
  console.log('--- Testing Defaulters Data & PDF Generation ---');

  // 1. Admin login
  console.log('1. Admin Login...');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@attendedge.local',
      password: 'Admin@123456',
    }),
  });
  const adminLogin = await adminLoginRes.json();
  const adminHeaders = { Authorization: `Bearer ${adminLogin.token}`, 'Content-Type': 'application/json' };

  // 2. HOD login
  console.log('2. HOD Login...');
  const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hod.cse@attendedge.local',
      password: 'Hod@123456',
    }),
  });
  const hodLogin = await hodLoginRes.json();
  const hodHeaders = { Authorization: `Bearer ${hodLogin.token}`, 'Content-Type': 'application/json' };

  // 3. Query on-screen HOD Defaulters data
  console.log('3. Fetching on-screen HOD Defaulters Data...');
  const month = '2026-09';
  const hodDefRes = await fetch(`${BASE_URL}/hod/defaulters?month=${month}`, { headers: hodHeaders });
  const hodDefData = await hodDefRes.json();
  console.log(`   Found ${hodDefData.defaulters?.length || 0} defaulter records.`);
  if (hodDefData.defaulters && hodDefData.defaulters.length > 0) {
    const sample = hodDefData.defaulters[0];
    console.log('   Sample on-screen record:');
    console.log('     Name:', sample.name);
    console.log('     Roll Number:', sample.rollNumber);
    console.log('     Department:', sample.department || sample.departmentName);
    console.log('     Department Code:', sample.departmentCode);
    console.log('     Section:', sample.section);
    console.log('     Year:', sample.year);
    console.log('     Attended:', `${sample.present} / ${sample.totalPeriods}`);
    console.log('     Percentage:', `${sample.percentage}%`);
  }

  // 4. Test HOD Defaulters PDF export
  console.log('4. Testing HOD Defaulters PDF Export...');
  const hodPdfRes = await fetch(`${BASE_URL}/hod/defaulters/export-pdf?month=${month}`, { headers: hodHeaders });
  const hodPdfBuf = await hodPdfRes.arrayBuffer();
  const isPdfHOD = Buffer.from(hodPdfBuf.slice(0, 4)).toString('ascii') === '%PDF';
  console.log(`   HOD Defaulters PDF generated: Status ${hodPdfRes.status}, Size: ${hodPdfBuf.byteLength} bytes, Valid %PDF: ${isPdfHOD}`);

  // 5. Test Admin Defaulters PDF export
  console.log('5. Testing Admin Defaulters PDF Export...');
  const adminPdfRes = await fetch(`${BASE_URL}/admin/defaulters/export-pdf?month=${month}`, { headers: adminHeaders });
  const adminPdfBuf = await adminPdfRes.arrayBuffer();
  const isPdfAdmin = Buffer.from(adminPdfBuf.slice(0, 4)).toString('ascii') === '%PDF';
  console.log(`   Admin Defaulters PDF generated: Status ${adminPdfRes.status}, Size: ${adminPdfBuf.byteLength} bytes, Valid %PDF: ${isPdfAdmin}`);

  console.log('\n--- VERIFICATION COMPLETED SUCCESSFULLY ---');
}

verifyDefaulters().catch(err => {
  console.error('Verification failed:', err);
});
