const Holiday = require('../models/Holiday');
const Department = require('../models/Department');
const { normalizeDate } = require('./helpers');

/**
 * Checks whether a given date is a configured Holiday
 * @param {Date|string} dateInput
 * @param {string|Object} [departmentInput] - Department ID or populated Department object
 * @returns {Promise<{ isHoliday: boolean, holiday: Object|null }>}
 */
async function isHoliday(dateInput, departmentInput = null) {
  try {
    const targetDate = normalizeDate(dateInput);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const orConditions = [{ scope: 'all' }];

    if (departmentInput) {
      let dept = departmentInput;
      if (typeof departmentInput === 'string' || (departmentInput._id && !departmentInput.course)) {
        const idToFind = departmentInput._id || departmentInput;
        try {
          dept = await Department.findById(idToFind);
        } catch (e) {
          dept = null;
        }
      }

      if (dept) {
        const deptId = dept._id || dept;
        const courseId = dept.course?._id || dept.course;
        if (courseId) {
          orConditions.push({ scope: 'course', course: courseId });
        }
        if (deptId) {
          orConditions.push({ scope: 'department', department: deptId });
        }
      }
    }

    const holiday = await Holiday.findOne({
      date: {
        $gte: targetDate,
        $lt: nextDate,
      },
      $or: orConditions,
    }).populate('course department');

    if (holiday) {
      return { isHoliday: true, holiday };
    }
    return { isHoliday: false, holiday: null };
  } catch (err) {
    console.error('isHoliday check error:', err);
    return { isHoliday: false, holiday: null };
  }
}

module.exports = {
  isHoliday,
};

