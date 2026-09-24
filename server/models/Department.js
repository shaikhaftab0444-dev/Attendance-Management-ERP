const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
}, {
  timestamps: true,
});

// Compound unique index: allows the same department code (e.g. "CSE") under different courses
departmentSchema.index({ course: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);

