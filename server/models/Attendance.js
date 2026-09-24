const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    required: true,
  },
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  periodSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PeriodSlot',
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
  },
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
  },
  records: [attendanceRecordSchema],
  markedAt: {
    type: Date,
    default: Date.now,
  },
  lastEditedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Compound unique index on date and periodSlot to prevent double submission
attendanceSchema.index({ date: 1, periodSlot: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
