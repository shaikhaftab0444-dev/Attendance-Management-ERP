const { parse } = require('csv-parse/sync');

/**
 * Universal CSV Parser
 * @param {Buffer|string} buffer
 * @returns {Array<Object>}
 */
function parseCsv(buffer) {
  if (!buffer) return [];
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : buffer;
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

/**
 * Universal CSV Stringifier
 * @param {Array<Object>} rows
 * @param {Array<string>} columns - Column headers
 * @returns {string} CSV text
 */
function toCsv(rows = [], columns = []) {
  if (!columns || columns.length === 0) {
    if (rows.length > 0) {
      columns = Object.keys(rows[0]);
    } else {
      return '';
    }
  }

  try {
    const { stringify } = require('csv-stringify/sync');
    return stringify(rows, {
      header: true,
      columns,
    });
  } catch (err) {
    // Robust native fallback
    const headerLine = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
    const bodyLines = rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col] !== undefined && row[col] !== null ? String(row[col]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    return [headerLine, ...bodyLines].join('\n');
  }
}

module.exports = {
  parseCsv,
  toCsv,
};
