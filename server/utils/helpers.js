const { parse } = require('csv-parse/sync');

/**
 * Calculates attendance percentage: (present + late) / total * 100
 */
const calculateAttendancePercentage = (presentCount = 0, lateCount = 0, absentCount = 0) => {
  const total = presentCount + lateCount + absentCount;
  if (total === 0) return 0;
  return Number((((presentCount + lateCount) / total) * 100).toFixed(2));
};

/**
 * Normalizes any date string or Date object to midnight UTC/Local date start
 */
const normalizeDate = (inputDate) => {
  const d = new Date(inputDate);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Parses CSV buffer into student records array with year support
 */
const parseStudentCsv = (buffer) => {
  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((row) => {
    const sem = Number(row.semester || row.Semester || 1);
    const parsedYear = Number(row.year || row.Year || Math.ceil(sem / 2) || 1);
    const validYear = [1, 2, 3, 4].includes(parsedYear) ? parsedYear : Math.min(4, Math.max(1, Math.ceil(sem / 2)));

    return {
      name: row.name || row.Name || '',
      rollNumber: (row.rollNumber || row.RollNumber || row.roll_no || row.RollNo || '').toUpperCase(),
      email: row.email || row.Email || '',
      phone: row.phone || row.Phone || '',
      semester: sem,
      year: validYear,
      sectionName: row.section || row.Section || '',
      departmentCode: (row.department || row.Department || row.departmentCode || '').toUpperCase(),
    };
  });
};

module.exports = {
  calculateAttendancePercentage,
  normalizeDate,
  parseStudentCsv,
};
