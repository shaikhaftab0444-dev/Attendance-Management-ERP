const BASE_URL = 'http://localhost:5000/api';

async function checkAttendanceRecords() {
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

  // Fetch recent attendance logs
  const logsRes = await fetch(`${BASE_URL}/hod/attendance`, { headers: hodHeaders });
  const logs = await logsRes.json();
  console.log(`Found ${logs.length} HOD attendance logs.`);

  const months = new Set();
  logs.forEach(l => {
    if (l.date) months.add(l.date.slice(0, 7));
  });
  console.log('Attendance months in DB:', Array.from(months));

  for (const m of months) {
    console.log(`\n--- Testing Month: ${m} ---`);
    const defRes = await fetch(`${BASE_URL}/hod/defaulters?month=${m}`, { headers: hodHeaders });
    const defData = await defRes.json();
    console.log(`Found ${defData.defaulters?.length || 0} defaulters in month ${m}:`);
    (defData.defaulters || []).slice(0, 5).forEach((d, i) => {
      console.log(`  [${i + 1}] Roll: ${d.rollNumber} | Name: ${d.name} | Dept: ${d.department} (${d.departmentCode}) | Sec: ${d.section} | Attended: ${d.present} / ${d.totalPeriods} | ${d.percentage}%`);
    });

    // Test PDF export for this month
    const pdfRes = await fetch(`${BASE_URL}/hod/defaulters/export-pdf?month=${m}`, { headers: hodHeaders });
    const pdfBuf = await pdfRes.arrayBuffer();
    const isPdf = Buffer.from(pdfBuf.slice(0, 4)).toString('ascii') === '%PDF';
    console.log(`  HOD Defaulters PDF for ${m}: Status ${pdfRes.status}, Size: ${pdfBuf.byteLength} bytes, Valid: ${isPdf}`);
  }
}

checkAttendanceRecords().catch(console.error);
