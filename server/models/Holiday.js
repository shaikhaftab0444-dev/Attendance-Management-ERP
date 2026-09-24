const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  scope: {
    type: String,
    enum: ['all', 'course', 'department'],
    default: 'all',
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    default: null,
  },
}, {
  timestamps: true,
});

holidaySchema.index({ date: 1, scope: 1, course: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);

