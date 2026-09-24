const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
    trim: true, // e.g. "2025-2026"
  },
  semesterLabel: {
    type: String,
    required: true,
    trim: true, // e.g. "Odd Semester", "Fall 2025"
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
