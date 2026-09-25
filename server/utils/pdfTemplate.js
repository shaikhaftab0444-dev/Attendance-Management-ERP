/**
 * Shared HTML Template generator for branded AttendEdge PDF exports.
 */

function escapeHtml(text) {
  if (text === null || text === undefined || text === '') return 'N/A';
  const str = String(text).trim();
  if (str === 'undefined' || str === 'NaN' || str === 'null') return 'N/A';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeCellOutput(val) {
  if (val === null || val === undefined) return 'N/A';
  let str = String(val).trim();
  if (!str || str === 'undefined' || str === 'NaN' || str === 'null') {
    return 'N/A';
  }
  // Clean any accidental "undefined", "NaN", "NaN / undefined", "undefined%", etc.
  str = str
    .replace(/\bNaN\s*\/\s*undefined\b/gi, 'N/A')
    .replace(/\bundefined\s*\/\s*undefined\b/gi, 'N/A')
    .replace(/\bNaN\s*%/gi, 'N/A')
    .replace(/\bundefined\s*%/gi, 'N/A')
    .replace(/\bundefined\b/gi, 'N/A')
    .replace(/\bNaN\b/gi, 'N/A');
  return str;
}

/**
 * Builds a clean, branded HTML document containing a data table
 * @param {object} params
 * @param {string} params.title - Document title (e.g. "Student Records Roster")
 * @param {string} [params.subtitle] - Subtitle or description
 * @param {object} [params.filters] - Key-value pairs of active filters (e.g. { Course: "B.Tech", Year: "2nd Year" })
 * @param {Array<{ header: string, key?: string, render?: Function, align?: 'left'|'center'|'right' }>} params.columns
 * @param {Array<object>} params.rows - Array of data objects
 * @param {string} [params.institutionName] - Name of institution
 */
function buildGenericTablePdfHtml({
  title,
  subtitle = '',
  filters = {},
  columns = [],
  rows = [],
  institutionName = 'AttendEdge Institute of Technology',
}) {
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const filterPills = Object.entries(filters)
    .filter(([_, val]) => val !== undefined && val !== null && val !== '' && val !== 'all')
    .map(
      ([key, val]) =>
        `<span class="filter-pill"><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</span>`
    )
    .join(' ');

  const tableHeaderHtml = columns
    .map(
      (col) =>
        `<th class="th-${col.align || 'left'}">${escapeHtml(col.header)}</th>`
    )
    .join('');

  const tableRowsHtml =
    rows.length > 0
      ? rows
          .map((row, idx) => {
            const cells = columns
              .map((col) => {
                let val = '';
                if (typeof col.render === 'function') {
                  const rendered = col.render(row, idx);
                  val = sanitizeCellOutput(rendered);
                } else if (col.key) {
                  val = escapeHtml(row[col.key]);
                }
                return `<td class="td-${col.align || 'left'}">${val}</td>`;
              })
              .join('');
            return `<tr>${cells}</tr>`;
          })
          .join('')
      : `<tr><td colspan="${columns.length}" class="empty-state">No matching records found</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      padding: 24px;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .institution-header {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    .sub-brand {
      font-size: 10px;
      font-weight: 600;
      color: #2563eb;
      margin-top: 3px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .doc-meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .doc-meta strong {
      color: #0f172a;
    }
    .report-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 12px;
    }
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
      padding: 6px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .filter-pill {
      font-size: 9px;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      padding: 2px 6px;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10px;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .th-left, .td-left { text-align: left; }
    .th-center, .td-center { text-align: center; }
    .th-right, .td-right { text-align: right; }
    .empty-state {
      text-align: center;
      padding: 24px;
      color: #94a3b8;
      font-style: italic;
    }
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: 700;
    }
    .badge-blue { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-purple { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-green { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-slate { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .badge-rose { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div>
      <div class="institution-header">${escapeHtml(institutionName || 'Everest College')}</div>
      <div class="sub-brand">${escapeHtml(institutionName || 'Everest College')} · OFFICIAL DOCUMENT</div>
    </div>
    <div class="doc-meta">
      <div><strong>Generated On:</strong> ${generatedAt}</div>
      <div><strong>Total Records:</strong> ${rows.length}</div>
    </div>
  </div>

  <div class="report-title">${escapeHtml(title)}</div>
  ${subtitle ? `<div class="report-subtitle">${escapeHtml(subtitle)}</div>` : ''}

  ${filterPills ? `<div class="filters-bar">${filterPills}</div>` : ''}

  <table>
    <thead>
      <tr>${tableHeaderHtml}</tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>${escapeHtml(institutionName || 'Everest College')} · Confidential</div>
    <div>Official Institutional Record</div>
  </div>
</body>
</html>`;
}

/**
 * Builds a print-ready weekly timetable grid HTML document
 * @param {object} params
 * @param {object} params.section - Section details (name, semester, year)
 * @param {object} params.course - Course details (name, code)
 * @param {object} params.department - Department details (name, code)
 * @param {object} [params.session] - Academic Session (year, semesterLabel)
 * @param {Array<{ periodNumber: number, label: string, startTime: string, endTime: string, isRecess?: boolean }>} params.periods
 * @param {Array<object>} params.slots - Array of populated PeriodSlot documents
 * @param {string} [params.institutionName] - Institution name
 */
function buildTimetablePdfHtml({
  section,
  course,
  department,
  session,
  periods = [],
  slots = [],
  institutionName = 'AttendEdge Institute of Technology',
}) {
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const daysOfWeek = [
    { key: 1, name: 'Monday' },
    { key: 2, name: 'Tuesday' },
    { key: 3, name: 'Wednesday' },
    { key: 4, name: 'Thursday' },
    { key: 5, name: 'Friday' },
    { key: 6, name: 'Saturday' },
  ];

  // Map slots by day and periodNumber
  const slotMap = new Map();
  slots.forEach((s) => {
    slotMap.set(`${s.dayOfWeek}_${s.periodNumber}`, s);
  });

  const periodRowsHtml =
    periods.length > 0
      ? periods
          .map((p) => {
            const isRecess = Boolean(p.isRecess);

            if (isRecess) {
              return `
        <tr class="recess-row">
          <td class="period-header">
            <div class="period-num">P${p.periodNumber}</div>
            <div class="period-time">${escapeHtml(p.startTime)} - ${escapeHtml(p.endTime)}</div>
          </td>
          <td colspan="6" class="recess-cell">
            <div class="recess-banner">★ RECESS / BREAK ★</div>
          </td>
        </tr>`;
            }

            const dayCells = daysOfWeek
              .map((d) => {
                const slot = slotMap.get(`${d.key}_${p.periodNumber}`);
                if (!slot || !slot.subject) {
                  return `<td class="slot-cell empty-slot"><span class="free-label">— Free —</span></td>`;
                }

                const subName = slot.subject.name || 'Subject';
                const subCode = slot.subject.code || '';
                const teacherName = slot.teacher?.name || 'Unassigned Faculty';
                const room = slot.room ? `Room ${escapeHtml(slot.room)}` : '';

                return `
          <td class="slot-cell active-slot">
            <div class="slot-sub-code">${escapeHtml(subCode)}</div>
            <div class="slot-sub-name">${escapeHtml(subName)}</div>
            <div class="slot-teacher">${escapeHtml(teacherName)}</div>
            ${room ? `<div class="slot-room">${room}</div>` : ''}
          </td>`;
              })
              .join('');

            return `
        <tr>
          <td class="period-header">
            <div class="period-num">P${p.periodNumber}</div>
            <div class="period-time">${escapeHtml(p.startTime)} - ${escapeHtml(p.endTime)}</div>
          </td>
          ${dayCells}
        </tr>`;
          })
          .join('')
      : `<tr><td colspan="7" class="empty-slot" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic;">No timetable periods configured for this section.</td></tr>`;

  const batchName = section?.batch?.name || (typeof section?.batch === 'string' ? section.batch : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Weekly Timetable - ${escapeHtml(section?.name || 'Section')}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 20px;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .institution-header {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }
    .timetable-subhead {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      margin-top: 3px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .title-banner {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #1e293b;
    }
    .section-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .pill-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .pill-purple { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
    .pill-emerald { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 8px 4px;
      text-align: center;
      border: 1px solid #334155;
    }
    th.period-col {
      width: 85px;
      background: #0f172a;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      vertical-align: top;
      text-align: center;
      height: 60px;
    }
    .period-header {
      background: #f1f5f9;
      font-weight: 700;
      vertical-align: middle;
      padding: 4px;
    }
    .period-num {
      font-size: 11px;
      color: #1e293b;
      font-weight: 800;
    }
    .period-time {
      font-size: 8.5px;
      color: #64748b;
      font-family: monospace;
      margin-top: 2px;
    }
    .slot-cell {
      padding: 4px 6px;
    }
    .active-slot {
      background: #ffffff;
    }
    .slot-sub-code {
      font-size: 8.5px;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 0.02em;
    }
    .slot-sub-name {
      font-size: 9.5px;
      font-weight: 700;
      color: #0f172a;
      margin: 1px 0;
      line-height: 1.2;
    }
    .slot-teacher {
      font-size: 8.5px;
      color: #475569;
      font-weight: 500;
    }
    .slot-room {
      font-size: 8px;
      color: #64748b;
      font-style: italic;
    }
    .empty-slot {
      background: #f8fafc;
      vertical-align: middle;
    }
    .free-label {
      font-size: 9px;
      color: #94a3b8;
      font-style: italic;
    }
    .recess-row td {
      height: 28px;
      background: #fef3c7;
      border: 1px solid #fde68a;
    }
    .recess-cell {
      vertical-align: middle;
      text-align: center;
    }
    .recess-banner {
      font-size: 10px;
      font-weight: 800;
      color: #92400e;
      letter-spacing: 0.08em;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <div class="institution-header">${escapeHtml(institutionName || 'Everest College')}</div>
      <div class="timetable-subhead">${escapeHtml(institutionName || 'Everest College')} · OFFICIAL TIMETABLE SCHEDULE</div>
    </div>
    <div class="meta-box">
      <div><strong>Generated:</strong> ${generatedAt}</div>
      ${session?.year ? `<div><strong>Academic Session:</strong> ${escapeHtml(session.year)} (${escapeHtml(session.semesterLabel || '')})</div>` : ''}
    </div>
  </div>

  <div class="title-banner">
    <div class="section-title">${escapeHtml(section?.name || 'Section Timetable')}</div>
    <div class="section-pills">
      ${course?.code ? `<span class="pill pill-blue">${escapeHtml(course.code)}</span>` : ''}
      ${department?.name ? `<span class="pill pill-purple">${escapeHtml(department.name)} (${escapeHtml(department.code || '')})</span>` : ''}
      ${batchName ? `<span class="pill pill-purple">${escapeHtml(batchName)} Batch</span>` : ''}
      ${section?.year ? `<span class="pill pill-emerald">Year ${escapeHtml(section.year)}</span>` : ''}
      ${section?.semester ? `<span class="pill pill-blue">Sem ${escapeHtml(section.semester)}</span>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="period-col">Period / Time</th>
        <th>Monday</th>
        <th>Tuesday</th>
        <th>Wednesday</th>
        <th>Thursday</th>
        <th>Friday</th>
        <th>Saturday</th>
      </tr>
    </thead>
    <tbody>
      ${periodRowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>${escapeHtml(institutionName || 'Everest College')} · Master Timetable Schedule</div>
    <div>Valid for the Current Academic Semester</div>
  </div>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  buildGenericTablePdfHtml,
  buildTimetablePdfHtml,
};
