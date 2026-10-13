const mongoose = require('mongoose');

const periodSlotSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
  },
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0,
    max: 6, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  },
  periodNumber: {
    type: Number,
    required: true,
  },
  startTime: {
    type: String,
    required: true, // e.g. "09:00"
  },
  endTime: {
    type: String,
    required: true, // e.g. "10:00"
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: function() { return !this.isRecess; },
    default: null,
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() { return !this.isRecess; },
    default: null,
  },
  isRecess: {
    type: Boolean,
    default: false,
  },
  recessLabel: {
    type: String,
    default: '',
    trim: true,
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true,
  },
}, {
  timestamps: true,
});

periodSlotSchema.index({ section: 1, dayOfWeek: 1, periodNumber: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('PeriodSlot', periodSlotSchema);
